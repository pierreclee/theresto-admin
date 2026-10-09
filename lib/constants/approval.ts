// Restaurant approval statuses (restaurants.approval_status)

// Submitted, waiting for an admin (pending_admin_review: SIREN could not be
// verified automatically, or resubmission after an automatic rejection)
export const TO_REVIEW_STATUSES = ['pending', 'pending_admin_review'];

// Shown in "Approbation", not in "Restaurants"
export const APPROVAL_QUEUE_STATUSES = [...TO_REVIEW_STATUSES, 'rejected'];

// Shown in "Restaurants"
export const LISTED_STATUSES = ['approved', 'suspended'];
