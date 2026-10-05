import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifySnapshotLifecycleMilestone,
  snapshotCommitmentDescriptor,
  snapshotForcesInsightsStage,
  snapshotInterestDescriptor,
  snapshotResponsivenessDescriptor,
  type SnapshotLifecycleFacts,
} from "@/lib/leads/snapshot-lifecycle";

function facts(partial: Partial<SnapshotLifecycleFacts> = {}): SnapshotLifecycleFacts {
  return {
    isBooked: false,
    contractStatus: null,
    venueSigned: false,
    requiredClientTotal: 1,
    requiredClientSigned: 0,
    hasPaymentOutstanding: false,
    ...partial,
  };
}

describe("Relationship Snapshot lifecycle precedence", () => {
  it("1. early inquiry — score language allowed", () => {
    assert.equal(classifySnapshotLifecycleMilestone(facts()), "early");
    assert.match(
      snapshotInterestDescriptor(facts(), 10),
      /Still early|reading the signals/i,
    );
    assert.match(
      snapshotCommitmentDescriptor(facts(), 10),
      /Just getting started|early steps|Progressing/i,
    );
    assert.equal(snapshotForcesInsightsStage(facts()), false);
  });

  it("2. contract sent, unsigned — not described as signed", () => {
    const f = facts({ contractStatus: "sent", requiredClientSigned: 0 });
    assert.equal(classifySnapshotLifecycleMilestone(f), "contract_sent");
    assert.equal(snapshotInterestDescriptor(f, 10), "Contract sent");
    assert.equal(
      snapshotCommitmentDescriptor(f, 40),
      "Contract sent · Awaiting signatures",
    );
    assert.doesNotMatch(snapshotInterestDescriptor(f, 10), /Still early/i);
    assert.doesNotMatch(snapshotCommitmentDescriptor(f, 40), /signed/i);
  });

  it("3. client signed, venue not signed — not Still early", () => {
    const f = facts({
      contractStatus: "sent",
      requiredClientSigned: 1,
      requiredClientTotal: 1,
      venueSigned: false,
    });
    assert.equal(classifySnapshotLifecycleMilestone(f), "client_signed");
    assert.equal(snapshotInterestDescriptor(f, 5), "Contract signed");
    assert.equal(
      snapshotCommitmentDescriptor(f, 40),
      "Contract signed · Not yet marked Booked",
    );
    assert.doesNotMatch(snapshotInterestDescriptor(f, 5), /Still early/i);
    assert.doesNotMatch(
      snapshotCommitmentDescriptor(f, 40),
      /Progressing toward booking/i,
    );
    assert.equal(snapshotForcesInsightsStage(f), true);
  });

  it("4. fully executed, not Booked — not Progressing toward booking", () => {
    const f = facts({
      contractStatus: "signed",
      venueSigned: true,
      requiredClientSigned: 1,
      requiredClientTotal: 1,
    });
    assert.equal(classifySnapshotLifecycleMilestone(f), "fully_executed");
    assert.equal(snapshotInterestDescriptor(f, 5), "Contract fully executed");
    assert.equal(
      snapshotCommitmentDescriptor(f, 45),
      "Contract fully executed · Not yet marked Booked",
    );
    assert.doesNotMatch(
      snapshotCommitmentDescriptor(f, 45),
      /Progressing toward booking/i,
    );
  });

  it("5. Booked — reflects Booked, not early-lead language", () => {
    const f = facts({
      isBooked: true,
      contractStatus: "signed",
      venueSigned: true,
      requiredClientSigned: 1,
    });
    assert.equal(classifySnapshotLifecycleMilestone(f), "booked");
    assert.equal(snapshotInterestDescriptor(f, 5), "Booked");
    assert.equal(snapshotCommitmentDescriptor(f, 20), "Booked");
    assert.doesNotMatch(snapshotInterestDescriptor(f, 5), /Still early/i);
  });

  it("5b. sales_stage booked without first_booked_at must not surface Booked", () => {
    // isBooked must be derived from first_booked_at (caller responsibility).
    const f = facts({
      isBooked: false,
      contractStatus: null,
    });
    assert.equal(classifySnapshotLifecycleMilestone(f), "early");
    assert.notEqual(snapshotInterestDescriptor(f, 5), "Booked");
    assert.notEqual(snapshotCommitmentDescriptor(f, 20), "Booked");
  });

  it("6. payment outstanding does not redefine Booked", () => {
    const outstandingNotBooked = facts({
      contractStatus: "signed",
      venueSigned: true,
      requiredClientSigned: 1,
      hasPaymentOutstanding: true,
    });
    assert.equal(classifySnapshotLifecycleMilestone(outstandingNotBooked), "fully_executed");
    assert.match(
      snapshotCommitmentDescriptor(outstandingNotBooked, 50),
      /Initial payment outstanding/,
    );
    assert.doesNotMatch(
      snapshotCommitmentDescriptor(outstandingNotBooked, 50),
      /^Booked$/,
    );

    const bookedWithOutstanding = facts({
      isBooked: true,
      hasPaymentOutstanding: true,
      contractStatus: "signed",
    });
    assert.equal(snapshotCommitmentDescriptor(bookedWithOutstanding, 50), "Booked");
  });

  it("7. fully executed + payment outstanding + not Booked — concepts stay distinct", () => {
    const f = facts({
      contractStatus: "signed",
      venueSigned: true,
      requiredClientSigned: 1,
      hasPaymentOutstanding: true,
      isBooked: false,
    });
    const commitment = snapshotCommitmentDescriptor(f, 80);
    assert.match(commitment, /fully executed/i);
    assert.match(commitment, /Not yet marked Booked/);
    assert.match(commitment, /Initial payment outstanding/);
    assert.notEqual(snapshotInterestDescriptor(f, 10), "Booked");
  });

  it("8. responsiveness remains score-based when evidence is thin", () => {
    assert.equal(
      snapshotResponsivenessDescriptor(5),
      "No pattern yet",
    );
  });

  it("9. authoritative proposal sent — never early / just-beginning language", () => {
    const f = facts({ proposalSent: true });
    assert.equal(classifySnapshotLifecycleMilestone(f), "proposal_sent");
    assert.equal(snapshotInterestDescriptor(f, 5), "Proposal sent");
    assert.equal(
      snapshotCommitmentDescriptor(f, 10),
      "Proposal sent · Awaiting next step",
    );
    assert.equal(snapshotForcesInsightsStage(f), true);
    assert.doesNotMatch(snapshotInterestDescriptor(f, 5), /Still early/i);
    assert.doesNotMatch(snapshotCommitmentDescriptor(f, 10), /Just getting started/i);
  });

  it("10. sales_stage cannot invent proposal_sent without the authoritative flag", () => {
    const f = facts({ proposalSent: false });
    assert.equal(classifySnapshotLifecycleMilestone(f), "early");
    assert.equal(snapshotForcesInsightsStage(f), false);
  });

  it("11. contract milestone outranks proposal_sent", () => {
    const f = facts({
      proposalSent: true,
      contractStatus: "sent",
      requiredClientSigned: 0,
    });
    assert.equal(classifySnapshotLifecycleMilestone(f), "contract_sent");
    assert.equal(snapshotInterestDescriptor(f, 5), "Contract sent");
  });
});
