Feature: Negative tests to validate failures
  These scenarios are intentionally incorrect to verify failure reporting

  Scenario: Wrong title should fail
    Given I open the example domain
    Then I should see the page title "Not The Title"

  Scenario: Missing heading should fail
    Given I open the example domain
    Then I should see the main heading "No Heading1"
