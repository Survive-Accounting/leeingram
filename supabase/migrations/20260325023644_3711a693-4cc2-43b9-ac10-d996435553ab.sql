-- Fix false-positive dependency detections caused by dollar amounts (e.g. "6.2%" FICA rate matching as "E6.2")

-- 1. Reset needs_review false positives (refs like e80.7, e142.500, e51.000 = dollar amounts, not problem refs)
UPDATE chapter_problems 
SET dependency_type = 'standalone', dependency_status = 'none', detected_dependency_ref = '', combined_group_id = NULL
WHERE dependency_type = 'dependent_problem' AND dependency_status = 'needs_review'
AND detected_dependency_ref IN ('e80.7', 'e142.500', 'e51.000', 'e1.100', 'e1.000', 'e25.000', 'e105.000');

-- 2. Reset incorrectly "combined" false positives (6.2% FICA tax rate matched as "e6.2")
UPDATE chapter_problems 
SET dependency_type = 'standalone', dependency_status = 'none', detected_dependency_ref = '', combined_group_id = NULL
WHERE dependency_type = 'dependent_problem' AND detected_dependency_ref = 'e6.2';