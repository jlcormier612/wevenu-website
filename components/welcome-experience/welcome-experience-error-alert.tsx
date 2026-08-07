/**
 * Quiet acceptance-error alert for the Welcome Experience.
 */

import {
  WELCOME_ACCEPTANCE_ERROR_DETAIL,
  WELCOME_ACCEPTANCE_ERROR_TITLE,
} from "./welcome-experience-helpers";

export function WelcomeExperienceErrorAlert() {
  return (
    <div
      role="alert"
      className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
      data-welcome-experience-error
    >
      <p>{WELCOME_ACCEPTANCE_ERROR_TITLE}</p>
      <p className="mt-0.5">{WELCOME_ACCEPTANCE_ERROR_DETAIL}</p>
    </div>
  );
}
