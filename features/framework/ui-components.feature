@framework @ui
Feature: Reusable UI components
  As a test engineer
  I want the shared pages and components verified against a known synthetic application
  So that business scenarios can rely on forms, tables, dialogs, notifications and navigation

  The component gallery is a local synthetic fixture. Its keyword rule (2 to 40 characters) is a
  fixture rule used to exercise boundaries; it is not a business requirement.

  Background:
    Given the component gallery catalog is open

  @positive @smoke
  Scenario: Search results are shown in the table and announced to assistive technology
    When the user searches the catalog for "widget" in the "Hardware" category
    Then the search is announced as "2 results found"
    And the results table lists exactly these items:
      | Name         | Category | Status       |
      | Widget Alpha | Hardware | Available    |
      | Widget Beta  | Hardware | Discontinued |

  @positive
  Scenario: A search without matches is announced and shows no table rows
    When the user searches the catalog for "nothing-matches" in the "Software" category
    Then the search is announced as "No results found"
    And the results table lists no items

  @negative @accessibility
  Scenario: Submitting without a keyword shows an error associated with the field
    When the user submits a catalog search with the keyword ""
    Then the search is rejected with the message "Enter a keyword to search"

  @boundary
  Scenario Outline: Keyword length is accepted only between 2 and 40 characters
    When the user submits a catalog search with a keyword of <length> characters
    Then the search is <outcome>

    Examples:
      | length | outcome                                                          |
      | 1      | rejected with the message "Keyword must be 2 to 40 characters" |
      | 2      | accepted                                                         |
      | 40     | accepted                                                         |
      | 41     | rejected with the message "Keyword must be 2 to 40 characters" |

  @positive @accessibility
  Scenario Outline: Item details open in a focused dialog and close with the <method>
    Given the user has searched the catalog for "widget" in the "Hardware" category
    When the user opens the details of "Widget Alpha"
    Then a dialog titled "Widget Alpha" is shown with keyboard focus inside it
    When the user closes the details dialog with the <method>
    Then no details dialog is shown

    Examples:
      | method        |
      | Close button  |
      | Escape key    |

  @positive
  Scenario: Main navigation moves to another page and marks it as current
    When the user navigates to the "About" section
    Then the page heading is "About this gallery"
    And "About" is marked as the current navigation item
