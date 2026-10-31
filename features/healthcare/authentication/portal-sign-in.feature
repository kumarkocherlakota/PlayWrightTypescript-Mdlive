@healthcare @ui @REQ-AUTH-001
Feature: Patient portal sign-in
  As a member
  I want to sign in to the patient portal securely
  So that only I can see and manage my appointments

  Runs against the local synthetic reference portal with a synthetic member account.
  Requirements are synthetic reference requirements (docs/traceability/requirements).

  @smoke @positive @AC-AUTH-001.1
  Scenario: A member signs in with valid credentials
    When the member signs in to the patient portal
    Then the member's appointment dashboard is shown

  @negative @AC-AUTH-001.2
  Scenario: A wrong password is refused without saying which detail was wrong
    When the member tries to sign in with a wrong password
    Then the member is not signed in
    And the sign-in page says "The email or password is incorrect."

  @security @AC-AUTH-001.3
  Scenario Outline: Portal pages require a signed-in member
    When a visitor who is not signed in opens the "<page>" page
    Then the visitor is sent to the sign-in page

    Examples:
      | page                |
      | my appointments     |
      | find a provider     |
      | book an appointment |

  @security @AC-AUTH-001.4
  Scenario: The portal session is protected from page scripts and other sites
    When the member signs in to the patient portal
    Then the session cookie is HttpOnly with SameSite "Strict"
    And page scripts cannot read the session cookie
