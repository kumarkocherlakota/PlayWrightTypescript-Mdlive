@framework @api
Feature: API layer self-checks
  As a test engineer
  I want the API layer to authenticate, verify contracts and clean up after itself
  So that API scenarios are trustworthy, isolated and leave no test data behind

  These scenarios run against the local synthetic inventory service only.

  @positive
  Scenario: A stocked item is stored as requested and can be retrieved
    When the test user stocks a new synthetic inventory item
    Then the item is stored exactly as requested
    And the stored item can be retrieved by its identifier

  @boundary
  Scenario Outline: Stock quantity limits
    When the test user tries to stock an item with a quantity of <quantity>
    Then the request is <outcome>

    Examples:
      | quantity | outcome                                |
      | -1       | rejected because "quantity" is invalid |
      | 0        | accepted                               |
      | 10000    | accepted                               |
      | 10001    | rejected because "quantity" is invalid |

  @boundary
  Scenario Outline: Item name length limits
    When the test user tries to stock an item with a name of <length> characters
    Then the request is <outcome>

    Examples:
      | length | outcome                            |
      | 0      | rejected because "name" is invalid |
      | 1      | accepted                           |
      | 80     | accepted                           |
      | 81     | rejected because "name" is invalid |

  @negative
  Scenario: A second item with the same SKU is refused
    Given the test user has stocked a new synthetic inventory item
    When the test user tries to stock another item with the same SKU
    Then the request is refused as a duplicate

  @negative
  Scenario: Fields outside the contract are refused
    When the test user tries to stock an item with an unrecognized "discount" field
    Then the request is rejected because "discount" is invalid

  @boundary
  Scenario Outline: Listing page size limits
    When the test user lists inventory with a page size of <limit>
    Then the request is <outcome>

    Examples:
      | limit | outcome                             |
      | 0     | rejected because "limit" is invalid |
      | 1     | accepted                            |
      | 100   | accepted                            |
      | 101   | rejected because "limit" is invalid |

  @positive
  Scenario: A filtered listing is limited to the requested page size
    Given the test user has stocked a batch of 3 synthetic inventory items
    When the test user lists the batch with a page size of 2
    Then 2 items of the batch are returned out of 3 matching items

  @positive
  Scenario: A removed item can no longer be retrieved
    Given the test user has stocked a new synthetic inventory item
    When the test user removes the item
    Then the item can no longer be retrieved

  @positive
  Scenario: Registered cleanup removes the test data of the scenario
    Given the test user has stocked a new synthetic inventory item
    When the test-data cleanup of the scenario runs
    Then the item can no longer be retrieved

  @security @negative
  Scenario Outline: Inventory is protected against callers without valid credentials
    When a caller with <credentials> lists inventory
    Then access is refused at the <stage> with HTTP status <status>

    Examples:
      | credentials         | stage          | status |
      | no credentials      | resource       | 401    |
      | an invalid token    | resource       | 401    |
      | unknown credentials | token endpoint | 400    |

  @security @positive
  Scenario: Credentials and access tokens never appear in the scenario log
    Given the test user has stocked a new synthetic inventory item
    Then the scenario log records the token request and the authenticated call
    And the scenario log contains no access token or credential
