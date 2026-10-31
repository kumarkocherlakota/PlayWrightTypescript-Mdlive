@healthcare @REQ-ACCESS-001
Feature: Accessible patient portal
  As a member who uses a keyboard or assistive technology
  I want to use every part of the patient portal
  So that I can manage my appointments independently

  Automated checks use axe-core against accessibility.standard and fail at or above
  accessibility.failOnImpact. They find only part of the WCAG failures and do not replace manual
  accessibility testing.

  @ui @accessibility @AC-ACCESS-001.1
  Scenario: The sign-in page passes automated accessibility checks
    When a visitor opens the sign-in page
    Then automated accessibility checks of "the sign-in page" find no violations at or above the configured impact

  @ui @accessibility @AC-ACCESS-001.1
  Scenario: The sign-in error passes automated accessibility checks
    When the member tries to sign in with a wrong password
    Then automated accessibility checks of "the sign-in page showing an error" find no violations at or above the configured impact

  @ui @api-setup @accessibility @AC-ACCESS-001.1
  Scenario: Provider search results pass automated accessibility checks
    Given the member is signed in to the patient portal
    And a synthetic "Pediatrics" provider offers 2 times
    When the member searches the portal for that provider by name
    Then automated accessibility checks of "the provider search results" find no violations at or above the configured impact

  @ui @api-setup @accessibility @AC-ACCESS-001.1
  Scenario: A booking field error passes automated accessibility checks
    Given the member is signed in to the patient portal
    And a synthetic "Pediatrics" provider offers 2 times
    When the member books the first time of that provider in the portal with a reason of no characters
    Then automated accessibility checks of "the booking form with a field error" find no violations at or above the configured impact

  @integration @accessibility @AC-ACCESS-001.1
  Scenario: The appointment dashboard passes automated accessibility checks
    Given the member is signed in to the patient portal
    And a synthetic "Pediatrics" provider offers 2 times
    And the first time of that provider has been booked through the API
    When the member views that appointment on the dashboard
    Then automated accessibility checks of "the appointment dashboard" find no violations at or above the configured impact

  @ui @accessibility @AC-ACCESS-001.2
  Scenario: The sign-in form can be completed with the keyboard alone
    When a visitor opens the sign-in page
    And the visitor moves keyboard focus forward 3 times
    Then keyboard focus moved through these controls, each with a visible focus indicator:
      | role    | name     |
      | textbox | Email    |
      | textbox | Password |
      | button  | Sign in  |

  @manual @ui @accessibility @AC-ACCESS-001.3
  Scenario: A screen-reader user can find, book and cancel an appointment
    Given a member uses the portal with a screen reader
    When the member finds a provider, books a time and cancels it
    Then every step is announced and can be completed without seeing the screen
