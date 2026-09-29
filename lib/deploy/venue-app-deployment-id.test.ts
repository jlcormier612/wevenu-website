import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/**
 * Venue-app version skew protection.
 * NEXT_DEPLOYMENT_ID is the image git SHA. Next uses it as deploymentId so a
 * browser that reaches a different task during a rollout reloads onto one
 * consistent build instead of failing a Server Action.
 */
describe("venue-app NEXT_DEPLOYMENT_ID", () => {
  const dockerfile = readFileSync(resolve("Dockerfile"), "utf8");
  const workflow = readFileSync(resolve(".github/workflows/deploy-sandbox.yml"), "utf8");
  const config = readFileSync(resolve("next.config.ts"), "utf8");
  const stack = readFileSync(resolve("infra/htc-ecs-stack.json"), "utf8");

  it("bakes the git SHA into the venue-app image at build and at runtime", () => {
    const builder = dockerfile.slice(0, dockerfile.indexOf("FROM node:22-alpine AS runner"));
    const runner = dockerfile.slice(dockerfile.indexOf("FROM node:22-alpine AS runner"));
    assert.match(builder, /ARG NEXT_DEPLOYMENT_ID/);
    assert.match(builder, /NEXT_DEPLOYMENT_ID=\$NEXT_DEPLOYMENT_ID/);
    assert.match(builder, /test -n "\$NEXT_DEPLOYMENT_ID"/);
    assert.ok(
      builder.indexOf("NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID") < builder.indexOf("RUN npm run build"),
      "the build must see NEXT_DEPLOYMENT_ID before next build",
    );
    assert.match(builder, /NEXT_DEPLOYMENT_ID=\$\{NEXT_DEPLOYMENT_ID\}/);
    assert.match(runner, /ARG NEXT_DEPLOYMENT_ID/);
    assert.match(runner, /NEXT_DEPLOYMENT_ID=\$NEXT_DEPLOYMENT_ID/);
  });

  it("passes github.sha as the venue-app build arg", () => {
    assert.match(workflow, /--build-arg "NEXT_DEPLOYMENT_ID=\$\{\{ github\.sha \}\}"/);
    const venueBlock = workflow.slice(
      workflow.indexOf("if [ \"${{ matrix.name }}\" = \"venue-app\" ]"),
      workflow.indexOf("docker build"),
    );
    assert.match(venueBlock, /NEXT_DEPLOYMENT_ID/);
  });

  it("points Next deploymentId at NEXT_DEPLOYMENT_ID", () => {
    assert.match(config, /deploymentId:\s*process\.env\.NEXT_DEPLOYMENT_ID/);
  });

  it("sets the running venue-app task env from the image tag and leaves other apps alone", () => {
    const venue = stack.slice(
      stack.indexOf('"VenueAppTaskDefinition"'),
      stack.indexOf('"MarketingTaskDefinition"'),
    );
    assert.match(venue, /"Name":"NEXT_DEPLOYMENT_ID"/);
    assert.match(venue, /"Fn::Select":\[1,\{"Fn::Split":\[":",\{"Ref":"VenueAppImage"\}\]\}\]/);
    const marketing = stack.slice(
      stack.indexOf('"MarketingTaskDefinition"'),
      stack.indexOf('"WorkspaceTaskDefinition"'),
    );
    assert.doesNotMatch(marketing, /NEXT_DEPLOYMENT_ID/);
  });
});
