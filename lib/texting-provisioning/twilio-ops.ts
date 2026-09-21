/**
 * Twilio ISV API operations for venue texting provisioning.
 * Lookup-before-create; never touches protected QuickCloud / Jen's Fancy SIDs.
 */
import {
  CreateSecretCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import {
  twilioErrorCode,
  twilioErrorMessage,
  twilioRequest,
  type TwilioCredentials,
} from "@/lib/sms/twilio-http";
import {
  loadParentTwilioCredentials,
  parentPrimaryCustomerProfileSid,
  TWILIO_A2P_MESSAGING_PROFILE_POLICY_SID,
  TWILIO_SECONDARY_CUSTOMER_PROFILE_POLICY_SID,
} from "@/lib/sms/twilio-parent";
import {
  assertNotProtectedTwilioSid,
  assertVenueAllowedForSelfServiceProvisioning,
} from "@/lib/sms/twilio-protected-resources";
import { venueTwilioSecretId } from "@/lib/sms/venue-twilio-secrets";
import { toE164 } from "@/lib/sms/phone";
import { isTwilioA2pMockEnabled } from "@/lib/texting-provisioning/feature";
import {
  buildA2pCampaignCreateFields,
  HELLO_TO_CHEERS_PRIVACY_POLICY_URL,
  HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL,
} from "@/lib/texting-registration/a2p-campaign-payload";

export type VenueBusinessForCompliance = {
  legalBusinessName: string;
  websiteUrl: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  contactEmail: string;
  contactPhone: string;
  businessType: string;
  businessIndustry: string;
  registrationIdType: string;
  registrationNumber: string;
  regionsOfOperation: string;
  repFirstName: string;
  repLastName: string;
  repEmail: string;
  repPhone: string;
  repBusinessTitle: string;
  repJobPosition: string;
  sampleMessage1: string;
  sampleMessage2: string;
  messagingPurpose?: string | null;
};

export type StepOutcome =
  | { ok: true; resourceSid?: string | null; detail?: Record<string, unknown>; waiting?: boolean }
  | { ok: false; retryable: boolean; code?: string | null; message: string; detail?: Record<string, unknown> };

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function mapBusinessType(raw: string): string {
  switch (raw) {
    case "sole_proprietorship": return "Sole Proprietorship";
    case "partnership": return "Partnership";
    case "llc": return "Limited Liability Corporation";
    case "corporation": return "Corporation";
    case "nonprofit": return "Non-profit Corporation";
    case "co_operative": return "Co-operative";
    default: return "Limited Liability Corporation";
  }
}

function mapJobPosition(raw: string): string {
  switch (raw) {
    case "ceo": return "CEO";
    case "cfo": return "CFO";
    case "gm": return "General Manager";
    case "vp": return "VP";
    case "director": return "Director";
    case "general_counsel": return "General Counsel";
    default: return "Other";
  }
}

function companyTypeForA2p(businessType: string): "private" | "public" | "non-profit" {
  if (businessType === "nonprofit") return "non-profit";
  if (businessType === "corporation") return "private";
  return "private";
}

export async function createVenueSubaccount(input: {
  venueId: string;
  friendlyName: string;
}): Promise<StepOutcome> {
  assertVenueAllowedForSelfServiceProvisioning(input.venueId);
  const parent = await loadParentTwilioCredentials();
  const result = await twilioRequest({
    method: "POST",
    url: `https://api.twilio.com/2010-04-01/Accounts.json`,
    credentials: parent,
    form: { FriendlyName: input.friendlyName.slice(0, 64) },
  });
  if (result.status === 201 || result.status === 200) {
    const sid = str(result.body.sid);
    assertNotProtectedTwilioSid(sid, "createVenueSubaccount");
    return {
      ok: true,
      resourceSid: sid,
      detail: { auth_token: str(result.body.auth_token) },
    };
  }
  return {
    ok: false,
    retryable: result.status >= 500 || result.status === 429,
    code: twilioErrorCode(result.body),
    message: twilioErrorMessage(result.body),
    detail: result.body,
  };
}

export async function createVenueApiKey(input: {
  venueId: string;
  accountSid: string;
  authToken: string;
  friendlyName: string;
}): Promise<StepOutcome> {
  assertVenueAllowedForSelfServiceProvisioning(input.venueId);
  assertNotProtectedTwilioSid(input.accountSid, "createVenueApiKey");
  const result = await twilioRequest({
    method: "POST",
    url: `https://api.twilio.com/2010-04-01/Accounts/${input.accountSid}/Keys.json`,
    credentials: { accountSid: input.accountSid, authToken: input.authToken },
    form: { FriendlyName: input.friendlyName.slice(0, 64) },
  });
  if (result.status === 201 || result.status === 200) {
    return {
      ok: true,
      resourceSid: str(result.body.sid),
      detail: { secret: str(result.body.secret) },
    };
  }
  return {
    ok: false,
    retryable: result.status >= 500 || result.status === 429,
    code: twilioErrorCode(result.body),
    message: twilioErrorMessage(result.body),
    detail: result.body,
  };
}

export async function storeVenueTwilioSecret(input: {
  venueId: string;
  accountSid: string;
  authToken: string;
  apiKeySid: string;
  apiKeySecret: string;
}): Promise<StepOutcome> {
  assertVenueAllowedForSelfServiceProvisioning(input.venueId);
  assertNotProtectedTwilioSid(input.accountSid, "storeVenueTwilioSecret");
  if (process.env.NODE_ENV === "test") {
    return { ok: true, resourceSid: input.accountSid };
  }
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
  });
  const secretId = venueTwilioSecretId(input.accountSid);
  const payload = JSON.stringify({
    account_sid: input.accountSid,
    auth_token: input.authToken,
    api_key_sid: input.apiKeySid,
    api_key_secret: input.apiKeySecret,
  });
  try {
    await client.send(new CreateSecretCommand({
      Name: secretId,
      SecretString: payload,
      Description: `HTC venue Twilio credentials (${input.venueId})`,
    }));
  } catch (err) {
    const name = err && typeof err === "object" && "name" in err
      ? String((err as { name: string }).name)
      : "";
    if (name === "ResourceExistsException") {
      await client.send(new PutSecretValueCommand({
        SecretId: secretId,
        SecretString: payload,
      }));
    } else {
      return {
        ok: false,
        retryable: true,
        message: err instanceof Error ? err.message : "Failed to store venue Twilio secret.",
      };
    }
  }
  return { ok: true, resourceSid: input.accountSid };
}

export async function createVenueMessagingService(input: {
  venueId: string;
  credentials: TwilioCredentials;
  friendlyName: string;
  inboundUrl: string;
  fallbackUrl: string;
  statusCallbackUrl: string;
}): Promise<StepOutcome> {
  assertVenueAllowedForSelfServiceProvisioning(input.venueId);
  assertNotProtectedTwilioSid(input.credentials.accountSid, "createVenueMessagingService");
  const result = await twilioRequest({
    method: "POST",
    url: "https://messaging.twilio.com/v1/Services",
    credentials: input.credentials,
    form: {
      FriendlyName: input.friendlyName.slice(0, 64),
      InboundRequestUrl: input.inboundUrl,
      FallbackUrl: input.fallbackUrl,
      StatusCallback: input.statusCallbackUrl,
      StickySender: "true",
      SmartEncoding: "true",
      UseInboundWebhookOnNumber: "true",
    },
  });
  if (result.status === 201 || result.status === 200) {
    const sid = str(result.body.sid);
    assertNotProtectedTwilioSid(sid, "createVenueMessagingService result");
    return { ok: true, resourceSid: sid };
  }
  return {
    ok: false,
    retryable: result.status >= 500 || result.status === 429,
    code: twilioErrorCode(result.body),
    message: twilioErrorMessage(result.body),
    detail: result.body,
  };
}

export async function configureMessagingServiceWebhooks(input: {
  venueId: string;
  credentials: TwilioCredentials;
  messagingServiceSid: string;
  inboundUrl: string;
  fallbackUrl: string;
  statusCallbackUrl: string;
}): Promise<StepOutcome> {
  assertNotProtectedTwilioSid(input.messagingServiceSid, "configureMessagingServiceWebhooks");
  const result = await twilioRequest({
    method: "POST",
    url: `https://messaging.twilio.com/v1/Services/${input.messagingServiceSid}`,
    credentials: input.credentials,
    form: {
      InboundRequestUrl: input.inboundUrl,
      FallbackUrl: input.fallbackUrl,
      StatusCallback: input.statusCallbackUrl,
      UseInboundWebhookOnNumber: "true",
    },
  });
  if (result.status === 200) {
    return { ok: true, resourceSid: input.messagingServiceSid };
  }
  return {
    ok: false,
    retryable: result.status >= 500 || result.status === 429,
    code: twilioErrorCode(result.body),
    message: twilioErrorMessage(result.body),
    detail: result.body,
  };
}

async function createEndUser(
  credentials: TwilioCredentials,
  friendlyName: string,
  type: string,
  attributes: Record<string, unknown>,
): Promise<StepOutcome> {
  const result = await twilioRequest({
    method: "POST",
    url: "https://trusthub.twilio.com/v1/EndUsers",
    credentials,
    form: {
      FriendlyName: friendlyName,
      Type: type,
      Attributes: JSON.stringify(attributes),
    },
  });
  if (result.status === 201 || result.status === 200) {
    return { ok: true, resourceSid: str(result.body.sid) };
  }
  return {
    ok: false,
    retryable: result.status >= 500 || result.status === 429,
    code: twilioErrorCode(result.body),
    message: twilioErrorMessage(result.body),
    detail: result.body,
  };
}

/** Fail closed when Trust Hub evaluation is noncompliant (HTTP 200 alone is not enough). */
function evaluationComplianceOutcome(
  body: Record<string, unknown>,
  label: string,
): StepOutcome | null {
  const status = str(body.status).toLowerCase();
  if (!status || status === "compliant") return null;
  const results = Array.isArray(body.results) ? body.results : [];
  const failures: string[] = [];
  for (const req of results) {
    if (!req || typeof req !== "object") continue;
    const row = req as Record<string, unknown>;
    if (row.passed === true) continue;
    const fields = Array.isArray(row.fields) ? row.fields : [];
    for (const field of fields) {
      if (!field || typeof field !== "object") continue;
      const f = field as Record<string, unknown>;
      if (f.passed === true) continue;
      const reason = str(f.failure_reason);
      if (reason) failures.push(reason);
    }
  }
  return {
    ok: false,
    retryable: false,
    code: status || "noncompliant",
    message: failures[0] || `${label} evaluation was not compliant.`,
    detail: body,
  };
}

async function assignEntity(
  credentials: TwilioCredentials,
  bundleUrl: string,
  objectSid: string,
): Promise<StepOutcome> {
  const result = await twilioRequest({
    method: "POST",
    url: `${bundleUrl}/EntityAssignments`,
    credentials,
    form: { ObjectSid: objectSid },
  });
  if (result.status === 201 || result.status === 200) {
    return { ok: true, resourceSid: str(result.body.sid) };
  }
  // Already assigned
  if (result.status === 409 || /already/i.test(twilioErrorMessage(result.body))) {
    return { ok: true, resourceSid: objectSid };
  }
  return {
    ok: false,
    retryable: result.status >= 500 || result.status === 429,
    code: twilioErrorCode(result.body),
    message: twilioErrorMessage(result.body),
    detail: result.body,
  };
}

export async function submitSecondaryCustomerProfile(input: {
  venueId: string;
  credentials: TwilioCredentials;
  business: VenueBusinessForCompliance;
  existingSid?: string | null;
}): Promise<StepOutcome> {
  assertVenueAllowedForSelfServiceProvisioning(input.venueId);
  assertNotProtectedTwilioSid(input.credentials.accountSid, "submitSecondaryCustomerProfile");
  if (input.existingSid) {
    assertNotProtectedTwilioSid(input.existingSid, "existing secondary");
    return { ok: true, resourceSid: input.existingSid };
  }

  const biz = input.business;
  const email = biz.contactEmail.trim();
  const create = await twilioRequest({
    method: "POST",
    url: "https://trusthub.twilio.com/v1/CustomerProfiles",
    credentials: input.credentials,
    form: {
      FriendlyName: `HTC venue ${biz.legalBusinessName}`.slice(0, 64),
      Email: email,
      PolicySid: TWILIO_SECONDARY_CUSTOMER_PROFILE_POLICY_SID,
    },
  });
  if (create.status !== 201 && create.status !== 200) {
    return {
      ok: false,
      retryable: create.status >= 500 || create.status === 429,
      code: twilioErrorCode(create.body),
      message: twilioErrorMessage(create.body),
      detail: create.body,
    };
  }
  const secondarySid = str(create.body.sid);
  assertNotProtectedTwilioSid(secondarySid, "secondary create");

  const businessEu = await createEndUser(
    input.credentials,
    `Business ${biz.legalBusinessName}`.slice(0, 64),
    "customer_profile_business_information",
    {
      business_name: biz.legalBusinessName,
      social_media_profile_urls: "",
      website_url: biz.websiteUrl,
      business_regions_of_operation: biz.regionsOfOperation || "USA_AND_CANADA",
      business_type: mapBusinessType(biz.businessType),
      business_registration_identifier: biz.registrationIdType || "EIN",
      business_identity: "direct_customer",
      business_industry: biz.businessIndustry || "HOSPITALITY",
      business_registration_number: biz.registrationNumber,
    },
  );
  if (!businessEu.ok) return businessEu;

  const repPhoneE164 = toE164(biz.repPhone);
  if (!repPhoneE164) {
    return {
      ok: false,
      retryable: false,
      code: "invalid_rep_phone",
      message: "Authorized representative phone must be a valid US/Canada number.",
    };
  }

  const repEu = await createEndUser(
    input.credentials,
    `Rep ${biz.repFirstName} ${biz.repLastName}`.slice(0, 64),
    "authorized_representative_1",
    {
      first_name: biz.repFirstName,
      last_name: biz.repLastName,
      email: biz.repEmail,
      phone_number: repPhoneE164,
      business_title: biz.repBusinessTitle,
      job_position: mapJobPosition(biz.repJobPosition),
    },
  );
  if (!repEu.ok) return repEu;

  const addr = await twilioRequest({
    method: "POST",
    url: `https://api.twilio.com/2010-04-01/Accounts/${input.credentials.accountSid}/Addresses.json`,
    credentials: input.credentials,
    form: {
      CustomerName: biz.legalBusinessName,
      Street: biz.addressLine1,
      StreetSecondary: biz.addressLine2 || undefined,
      City: biz.city,
      Region: biz.stateRegion,
      PostalCode: biz.postalCode,
      IsoCountry: biz.country.length === 2 ? biz.country.toUpperCase() : "US",
    },
  });
  if (addr.status !== 201 && addr.status !== 200) {
    return {
      ok: false,
      retryable: addr.status >= 500 || addr.status === 429,
      code: twilioErrorCode(addr.body),
      message: twilioErrorMessage(addr.body),
      detail: addr.body,
    };
  }
  const addressSid = str(addr.body.sid);

  const doc = await twilioRequest({
    method: "POST",
    url: "https://trusthub.twilio.com/v1/SupportingDocuments",
    credentials: input.credentials,
    form: {
      FriendlyName: `Address ${biz.legalBusinessName}`.slice(0, 64),
      Type: "customer_profile_address",
      Attributes: JSON.stringify({ address_sids: addressSid }),
    },
  });
  if (doc.status !== 201 && doc.status !== 200) {
    return {
      ok: false,
      retryable: doc.status >= 500 || doc.status === 429,
      code: twilioErrorCode(doc.body),
      message: twilioErrorMessage(doc.body),
      detail: doc.body,
    };
  }
  const docSid = str(doc.body.sid);

  const bundleUrl = `https://trusthub.twilio.com/v1/CustomerProfiles/${secondarySid}`;
  for (const objectSid of [businessEu.resourceSid!, repEu.resourceSid!, docSid, parentPrimaryCustomerProfileSid()]) {
    const asg = await assignEntity(input.credentials, bundleUrl, objectSid);
    if (!asg.ok) return asg;
  }

  const evaluation = await twilioRequest({
    method: "POST",
    url: `${bundleUrl}/Evaluations`,
    credentials: input.credentials,
    form: { PolicySid: TWILIO_SECONDARY_CUSTOMER_PROFILE_POLICY_SID },
  });
  if (evaluation.status !== 201 && evaluation.status !== 200) {
    return {
      ok: false,
      retryable: evaluation.status >= 500 || evaluation.status === 429,
      code: twilioErrorCode(evaluation.body),
      message: twilioErrorMessage(evaluation.body),
      detail: evaluation.body,
    };
  }
  const evaluationFail = evaluationComplianceOutcome(
    evaluation.body,
    "Secondary customer profile",
  );
  if (evaluationFail) return evaluationFail;

  const submit = await twilioRequest({
    method: "POST",
    url: bundleUrl,
    credentials: input.credentials,
    form: { Status: "pending-review" },
  });
  if (submit.status !== 200 && submit.status !== 201) {
    return {
      ok: false,
      retryable: submit.status >= 500 || submit.status === 429,
      code: twilioErrorCode(submit.body),
      message: twilioErrorMessage(submit.body),
      detail: submit.body,
    };
  }

  return {
    ok: true,
    resourceSid: secondarySid,
    detail: { status: str(submit.body.status) },
  };
}

export async function submitA2pTrustProduct(input: {
  venueId: string;
  credentials: TwilioCredentials;
  secondaryProfileSid: string;
  business: VenueBusinessForCompliance;
  existingSid?: string | null;
}): Promise<StepOutcome> {
  assertNotProtectedTwilioSid(input.secondaryProfileSid, "submitA2pTrustProduct secondary");
  if (input.existingSid) {
    assertNotProtectedTwilioSid(input.existingSid, "existing trust");
    return { ok: true, resourceSid: input.existingSid };
  }

  const create = await twilioRequest({
    method: "POST",
    url: "https://trusthub.twilio.com/v1/TrustProducts",
    credentials: input.credentials,
    form: {
      FriendlyName: `HTC A2P ${input.business.legalBusinessName}`.slice(0, 64),
      Email: input.business.contactEmail,
      PolicySid: TWILIO_A2P_MESSAGING_PROFILE_POLICY_SID,
    },
  });
  if (create.status !== 201 && create.status !== 200) {
    return {
      ok: false,
      retryable: create.status >= 500 || create.status === 429,
      code: twilioErrorCode(create.body),
      message: twilioErrorMessage(create.body),
      detail: create.body,
    };
  }
  const trustSid = str(create.body.sid);
  assertNotProtectedTwilioSid(trustSid, "trust create");

  const a2pInfo = await createEndUser(
    input.credentials,
    `A2P info ${input.business.legalBusinessName}`.slice(0, 64),
    "us_a2p_messaging_profile_information",
    { company_type: companyTypeForA2p(input.business.businessType) },
  );
  if (!a2pInfo.ok) return a2pInfo;

  const bundleUrl = `https://trusthub.twilio.com/v1/TrustProducts/${trustSid}`;
  for (const objectSid of [a2pInfo.resourceSid!, input.secondaryProfileSid]) {
    const asg = await assignEntity(input.credentials, bundleUrl, objectSid);
    if (!asg.ok) return asg;
  }

  const evaluation = await twilioRequest({
    method: "POST",
    url: `${bundleUrl}/Evaluations`,
    credentials: input.credentials,
    form: { PolicySid: TWILIO_A2P_MESSAGING_PROFILE_POLICY_SID },
  });
  if (evaluation.status !== 201 && evaluation.status !== 200) {
    return {
      ok: false,
      retryable: evaluation.status >= 500 || evaluation.status === 429,
      code: twilioErrorCode(evaluation.body),
      message: twilioErrorMessage(evaluation.body),
      detail: evaluation.body,
    };
  }
  const evaluationFail = evaluationComplianceOutcome(
    evaluation.body,
    "A2P messaging profile",
  );
  if (evaluationFail) return evaluationFail;

  const submit = await twilioRequest({
    method: "POST",
    url: bundleUrl,
    credentials: input.credentials,
    form: { Status: "pending-review" },
  });
  if (submit.status !== 200 && submit.status !== 201) {
    return {
      ok: false,
      retryable: submit.status >= 500 || submit.status === 429,
      code: twilioErrorCode(submit.body),
      message: twilioErrorMessage(submit.body),
      detail: submit.body,
    };
  }

  return { ok: true, resourceSid: trustSid, detail: { status: str(submit.body.status) } };
}

export async function submitBrandRegistration(input: {
  venueId: string;
  credentials: TwilioCredentials;
  secondaryProfileSid: string;
  trustProductSid: string;
  existingSid?: string | null;
}): Promise<StepOutcome> {
  if (input.existingSid) {
    assertNotProtectedTwilioSid(input.existingSid, "existing brand");
    return { ok: true, resourceSid: input.existingSid };
  }
  assertNotProtectedTwilioSid(input.secondaryProfileSid, "brand secondary");
  assertNotProtectedTwilioSid(input.trustProductSid, "brand trust");

  const form: Record<string, string> = {
    CustomerProfileBundleSid: input.secondaryProfileSid,
    A2PProfileBundleSid: input.trustProductSid,
    BrandType: "STANDARD",
    SkipAutomaticSecVet: "true",
  };
  if (isTwilioA2pMockEnabled()) {
    form.Mock = "true";
  }

  const result = await twilioRequest({
    method: "POST",
    url: "https://messaging.twilio.com/v1/a2p/BrandRegistrations",
    credentials: input.credentials,
    form,
  });
  if (result.status === 201 || result.status === 200) {
    const sid = str(result.body.sid);
    assertNotProtectedTwilioSid(sid, "brand create");
    return {
      ok: true,
      resourceSid: sid,
      detail: {
        status: str(result.body.status),
        tcr_id: result.body.tcr_id ?? null,
        mock: result.body.mock ?? false,
      },
    };
  }
  return {
    ok: false,
    retryable: result.status >= 500 || result.status === 429,
    code: twilioErrorCode(result.body),
    message: twilioErrorMessage(result.body),
    detail: result.body,
  };
}

export async function fetchBrandStatus(input: {
  credentials: TwilioCredentials;
  brandSid: string;
}): Promise<StepOutcome> {
  assertNotProtectedTwilioSid(input.brandSid, "fetchBrandStatus");
  const result = await twilioRequest({
    method: "GET",
    url: `https://messaging.twilio.com/v1/a2p/BrandRegistrations/${input.brandSid}`,
    credentials: input.credentials,
  });
  if (result.status !== 200) {
    return {
      ok: false,
      retryable: result.status >= 500 || result.status === 429,
      code: twilioErrorCode(result.body),
      message: twilioErrorMessage(result.body),
      detail: result.body,
    };
  }
  const status = str(result.body.status).toUpperCase();
  if (status === "APPROVED") {
    return {
      ok: true,
      resourceSid: input.brandSid,
      detail: {
        status,
        tcr_id: result.body.tcr_id ?? null,
        identity_status: result.body.identity_status ?? null,
      },
    };
  }
  if (status === "FAILED" || status === "SUSPENDED") {
    return {
      ok: false,
      retryable: false,
      code: status,
      message: str(result.body.failure_reason) || `Brand ${status}`,
      detail: result.body,
    };
  }
  return {
    ok: true,
    waiting: true,
    resourceSid: input.brandSid,
    detail: { status },
  };
}

/**
 * Create Campaign ONLY after Brand APPROVED, on Messaging Service that may have zero phones.
 */
export async function submitCampaign(input: {
  venueId: string;
  credentials: TwilioCredentials;
  messagingServiceSid: string;
  brandSid: string;
  brandName: string;
  sampleMessage1: string;
  sampleMessage2: string;
  existingSid?: string | null;
}): Promise<StepOutcome> {
  if (input.existingSid) {
    assertNotProtectedTwilioSid(input.existingSid, "existing campaign");
    return { ok: true, resourceSid: input.existingSid };
  }
  assertNotProtectedTwilioSid(input.messagingServiceSid, "campaign ms");
  assertNotProtectedTwilioSid(input.brandSid, "campaign brand");

  const fields = buildA2pCampaignCreateFields({
    brandRegistrationSid: input.brandSid,
    brandName: input.brandName,
    messageSamples: [input.sampleMessage1, input.sampleMessage2],
    privacyPolicyUrl: HELLO_TO_CHEERS_PRIVACY_POLICY_URL,
    termsUrl: HELLO_TO_CHEERS_TERMS_AND_CONDITIONS_URL,
  });

  const pairs: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) pairs.push([key, item]);
    } else {
      pairs.push([key, String(value)]);
    }
  }

  const result = await twilioRequest({
    method: "POST",
    url: `https://messaging.twilio.com/v1/Services/${input.messagingServiceSid}/Compliance/Usa2p`,
    credentials: input.credentials,
    pairs,
  });
  if (result.status === 201 || result.status === 200) {
    const sid = str(result.body.sid);
    // SID string may coincidentally match another account's; bind by account+MS.
    return {
      ok: true,
      resourceSid: sid,
      detail: {
        status: str(result.body.campaign_status || result.body.status),
        account_sid: result.body.account_sid,
        messaging_service_sid: result.body.messaging_service_sid,
        mock: result.body.mock ?? false,
      },
    };
  }
  return {
    ok: false,
    retryable: result.status >= 500 || result.status === 429,
    code: twilioErrorCode(result.body),
    message: twilioErrorMessage(result.body),
    detail: result.body,
  };
}

export async function fetchCampaignStatus(input: {
  credentials: TwilioCredentials;
  messagingServiceSid: string;
  campaignSid: string;
}): Promise<StepOutcome> {
  assertNotProtectedTwilioSid(input.messagingServiceSid, "fetchCampaign ms");
  const result = await twilioRequest({
    method: "GET",
    url: `https://messaging.twilio.com/v1/Services/${input.messagingServiceSid}/Compliance/Usa2p/${input.campaignSid}`,
    credentials: input.credentials,
  });
  if (result.status !== 200) {
    return {
      ok: false,
      retryable: result.status >= 500 || result.status === 429,
      code: twilioErrorCode(result.body),
      message: twilioErrorMessage(result.body),
      detail: result.body,
    };
  }
  const status = str(result.body.campaign_status || result.body.status).toUpperCase();
  if (status === "VERIFIED" || status === "APPROVED") {
    return { ok: true, resourceSid: input.campaignSid, detail: { status } };
  }
  if (status === "FAILED" || status === "REJECTED") {
    return {
      ok: false,
      retryable: false,
      code: status,
      message: "Campaign was not approved.",
      detail: result.body,
    };
  }
  return {
    ok: true,
    waiting: true,
    resourceSid: input.campaignSid,
    detail: { status },
  };
}

export async function buyVenuePhoneNumber(input: {
  venueId: string;
  credentials: TwilioCredentials;
  existingSid?: string | null;
}): Promise<StepOutcome> {
  if (input.existingSid) {
    assertNotProtectedTwilioSid(input.existingSid, "existing phone");
    return { ok: true, resourceSid: input.existingSid };
  }
  assertVenueAllowedForSelfServiceProvisioning(input.venueId);

  const avail = await twilioRequest({
    method: "GET",
    url: `https://api.twilio.com/2010-04-01/Accounts/${input.credentials.accountSid}/AvailablePhoneNumbers/US/Local.json?SmsEnabled=true&Limit=5`,
    credentials: input.credentials,
  });
  if (avail.status !== 200) {
    return {
      ok: false,
      retryable: avail.status >= 500 || avail.status === 429,
      code: twilioErrorCode(avail.body),
      message: twilioErrorMessage(avail.body),
      detail: avail.body,
    };
  }
  const numbers = (avail.body.available_phone_numbers as Array<{ phone_number?: string }> | undefined) ?? [];
  if (!numbers.length || !numbers[0].phone_number) {
    return { ok: false, retryable: true, message: "No SMS-capable numbers available right now." };
  }

  const buy = await twilioRequest({
    method: "POST",
    url: `https://api.twilio.com/2010-04-01/Accounts/${input.credentials.accountSid}/IncomingPhoneNumbers.json`,
    credentials: input.credentials,
    form: { PhoneNumber: numbers[0].phone_number },
  });
  if (buy.status === 201 || buy.status === 200) {
    const sid = str(buy.body.sid);
    assertNotProtectedTwilioSid(sid, "buy phone");
    return {
      ok: true,
      resourceSid: sid,
      detail: { e164: str(buy.body.phone_number) },
    };
  }
  return {
    ok: false,
    retryable: buy.status >= 500 || buy.status === 429,
    code: twilioErrorCode(buy.body),
    message: twilioErrorMessage(buy.body),
    detail: buy.body,
  };
}

export async function attachPhoneToMessagingService(input: {
  credentials: TwilioCredentials;
  messagingServiceSid: string;
  phoneNumberSid: string;
}): Promise<StepOutcome> {
  assertNotProtectedTwilioSid(input.messagingServiceSid, "attach ms");
  assertNotProtectedTwilioSid(input.phoneNumberSid, "attach phone");

  const listed = await twilioRequest({
    method: "GET",
    url: `https://messaging.twilio.com/v1/Services/${input.messagingServiceSid}/PhoneNumbers`,
    credentials: input.credentials,
  });
  if (listed.status === 200) {
    const phones = (listed.body.phone_numbers as Array<{ sid?: string }> | undefined) ?? [];
    if (phones.some((p) => p.sid === input.phoneNumberSid)) {
      return { ok: true, resourceSid: input.phoneNumberSid };
    }
  }

  const result = await twilioRequest({
    method: "POST",
    url: `https://messaging.twilio.com/v1/Services/${input.messagingServiceSid}/PhoneNumbers`,
    credentials: input.credentials,
    form: { PhoneNumberSid: input.phoneNumberSid },
  });
  if (result.status === 201 || result.status === 200) {
    return { ok: true, resourceSid: str(result.body.sid) || input.phoneNumberSid };
  }
  return {
    ok: false,
    retryable: result.status >= 500 || result.status === 429,
    code: twilioErrorCode(result.body),
    message: twilioErrorMessage(result.body),
    detail: result.body,
  };
}
