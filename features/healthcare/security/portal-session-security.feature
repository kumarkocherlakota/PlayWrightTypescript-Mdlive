@healthcare @ui @REQ-AUTH-002
Feature: Portal session and response protections
  As a member
  I want my portal session to end when I sign out and my pages to be protected by the browser
  So that nobody can reuse my session or embed and script my pages

  Security scenarios run only against hosts listed in security.authorizedHosts.

  Background:
    Given the member is signed in to the patient portal

  @security @AC-AUTH-002.1
  Scenario: Signing out ends the session for good
    When the member signs out and the session from before signing out is sent again
    Then the browser no longer holds a portal session
    And the portal does not accept the previous session

  @security @AC-AUTH-002.2
  Scenario Outline: Portal pages declare browser protections
    When the <page> page is requested
    Then the response forbids framing, inline scripts and content-type sniffing and limits referrer information

    Examples:
      | page                |
      | sign-in             |
      | my appointments     |
      | find a provider     |
      | book an appointment |

  @blocked @security @AC-AUTH-002.3
  Scenario: An idle session expires after the configured session timeout
    When the member stays idle for longer than the configured session timeout
    Then the next portal page asks the member to sign in again
