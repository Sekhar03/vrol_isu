Feature: Visa Chargeback Dispute Management Workflow
  As a portal user (Merchant, Admin, or Partner)
  I want to raise, track, manage, and resolve chargeback disputes
  So that chargebacks are handled efficiently between all stakeholders.

  Background:
    Given the Chargeback system is running
    And the following portals are active: Merchant Portal, Admin Portal, and Partner Portal

  # ---------------------------------------------------------
  # MERCHANT PORTAL FLOWS
  # ---------------------------------------------------------

  Scenario: Merchant views dashboard and filters disputes
    Given I am logged into the Merchant Portal
    When I view the dashboard stats
    And I apply date range filters
    Then the dispute counts and SLA counts should update accordingly

  Scenario: Merchant clicks Action Required SLA card to filter and scroll
    Given I am logged into the Merchant Portal
    When I click the "Due Today" SLA card under "Action Required" tab
    Then the dispute list is filtered to cases due today on the same tab
    And the cards row remains sticky at the top
    And the page scrolls smoothly down to the reports table

  Scenario: Merchant opens dispute details to view split layout
    Given I am logged into the Merchant Portal
    When I click on a dispute case to view its details
    Then the sidebar collapses and navigation links are hidden
    And a vertical split preview panel slides in from the right
    And the header displays the dispute amount and SLA pending days in red (with SLA font larger)
    And the left column displays the action buttons, uploaded documents, and timeline
    And the right column displays transaction details and dispute info

  Scenario: Merchant accepts liability for a dispute
    Given I am logged into the Merchant Portal
    And I am viewing details of an active dispute case
    When I click "Accept Liability" in the split preview panel
    Then the dispute status transitions to "Merchant_Accepted"
    And the dispute is closed

  Scenario: Merchant contests a dispute by uploading evidence
    Given I am logged into the Merchant Portal
    And I am viewing details of an active dispute case with no documents uploaded
    When I click "Contest & Submit Proof" in the split preview panel
    And I attach supporting documents and submit
    Then the dispute status transitions to "Representment_Submitted"
    And the case moves to "Under Review" tab

  Scenario: Merchant uploads more evidence for a pending dispute
    Given I am logged into the Merchant Portal
    And I am viewing details of a dispute that already has documents uploaded
    When I click the "Upload More Evidence" button
    And I attach additional files and submit
    Then the new files are added to the evidence list

  Scenario: Merchant uses inline row actions and tooltips in Under Review tab
    Given I am logged into the Merchant Portal
    When I switch to the "Under Review" tab
    Then each dispute row displays inline "Upload More Evidence" (📤) and "Comment" (💬) icons
    When I hover over the Upload icon
    Then a custom tooltip "Upload More Evidence" appears
    When I click the Comment icon
    Then the case is selected and the Add Comment modal opens

  Scenario: Merchant views Closed tab stats
    Given I am logged into the Merchant Portal
    When I switch to the "Closed" tab
    Then the cards panel displays four stats: Total Disputes, Won, Lost, and Representment Win Ratio

  Scenario: Merchant exports filtered list to CSV
    Given I am logged into the Merchant Portal
    When I apply search filters and click "Export"
    Then the downloaded CSV contains only the filtered dispute records

  Scenario: Merchant accesses floating FAQ help widget
    Given I am logged into the Merchant Portal
    When I click the "FAQ & Help" sidebar item or the circular "?" button
    Then a floating FAQ widget opens in the bottom-right corner
    And the background content remains fully visible and interactive
    When I navigate to the "Dashboard"
    Then the floating FAQ widget closes

  # ---------------------------------------------------------
  # ADMIN PORTAL FLOWS
  # ---------------------------------------------------------

  Scenario: Admin reviews dashboard analytics
    Given I am logged into the Admin Portal
    When I view the dashboard
    Then I see portfolio-wide dispute stats and visual charts (donut, pie, bar)

  Scenario: Admin views disputes queue with tab counts
    Given I am logged into the Admin Portal
    When I switch between tabs (Action Required, Under Review, Closed, All Disputes)
    Then each tab displays its respective dispute count in brackets next to the label

  Scenario: Admin approves merchant representment evidence
    Given I am logged into the Admin Portal
    And there is a dispute under review with merchant evidence
    When I select the dispute and click "Approve Representment"
    Then the dispute transitions to NPCI grid/VROL queue
    And the merchant is notified

  Scenario: Admin declines merchant representment evidence
    Given I am logged into the Admin Portal
    And there is a dispute under review with merchant evidence
    When I select the dispute and click "Decline Representment"
    And I enter the mandatory rejection remarks
    Then the dispute status reverts to "Document Rejected"
    And it returns to the Merchant's Action Required queue

  Scenario: Admin imports VROL disputes
    Given I am logged into the Admin Portal
    When I navigate to "VROL Import"
    And I upload a valid Visa VROL dispute batch file
    Then the new disputes are created and populated in the system

  Scenario: Admin accesses floating help
    Given I am logged into the Admin Portal
    When I click the circular "?" button in the bottom-right corner
    Then the floating FAQ widget opens in the bottom-right corner

  # ---------------------------------------------------------
  # PARTNER PORTAL FLOWS
  # ---------------------------------------------------------

  Scenario: Partner reviews portfolio stats and merchant details
    Given I am logged into the Partner Portal
    When I view "Portfolio Analytics"
    Then I see the aggregated stats of all my onboarded merchants
    When I click "Merchant Details"
    Then I can view and search profiles of my affiliated merchants

  Scenario: Partner uploads bulk disputes
    Given I am logged into the Partner Portal
    When I go to Dispute Management
    And I click "Bulk Upload"
    And I upload a dispute spreadsheet template
    Then multiple disputes are created under the respective merchants

  Scenario: Partner accesses floating FAQ help widget
    Given I am logged into the Partner Portal
    When I click "FAQ & Help" in the sidebar or the "?" button
    Then the floating FAQ widget opens in the bottom-right corner
    And the background analytics dashboard remains visible and interactive
    When I click "Portfolio Analytics"
    Then the floating FAQ widget closes
