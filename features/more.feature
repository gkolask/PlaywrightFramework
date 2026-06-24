Feature: Additional checks for example domain
  As a tester
  I want to verify extra content on the example domain page

  Scenario: Verify example domain paragraph contains expected text
    Given I open the example domain
    Then I should see the paragraph "illustrative examples"
