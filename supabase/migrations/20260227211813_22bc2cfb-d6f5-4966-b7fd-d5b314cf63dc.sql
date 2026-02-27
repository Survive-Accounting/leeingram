
CREATE TABLE public.topic_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_short TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  topic_name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.topic_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read topic_templates" ON public.topic_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write topic_templates" ON public.topic_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update topic_templates" ON public.topic_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete topic_templates" ON public.topic_templates FOR DELETE TO authenticated USING (true);

-- Seed IA2 Chapter 13
INSERT INTO public.topic_templates (course_short, chapter_number, topic_name, display_order) VALUES
('IA2', 13, 'Bond Issue Entries', 0),
('IA2', 13, 'Interest + Amortization (Effective Interest)', 1),
('IA2', 13, 'Amortization Table Problems', 2),
('IA2', 13, 'Bond Retirement / Redemption', 3),
('IA2', 13, 'Debt Settlement', 4),
('IA2', 13, 'Troubled Debt Restructuring / Term Modifications', 5);

-- Seed IA2 Chapter 14
INSERT INTO public.topic_templates (course_short, chapter_number, topic_name, display_order) VALUES
('IA2', 14, 'Common Stock Issuance', 0),
('IA2', 14, 'Preferred Stock Problems', 1),
('IA2', 14, 'Treasury Stock (Cost Method)', 2),
('IA2', 14, 'Dividends (Cash, Stock, Splits)', 3),
('IA2', 14, 'Retained Earnings / Prior Period Adjustments', 4),
('IA2', 14, 'Equity Rollforward / Statement Problems', 5);

-- Seed IA2 Chapter 15
INSERT INTO public.topic_templates (course_short, chapter_number, topic_name, display_order) VALUES
('IA2', 15, 'Basic EPS', 0),
('IA2', 15, 'Weighted Average Shares', 1),
('IA2', 15, 'Stock Options / Treasury Stock Method', 2),
('IA2', 15, 'Convertible Bonds (If-Converted)', 3),
('IA2', 15, 'Convertible Preferred Stock', 4),
('IA2', 15, 'Dilution Decision Rules', 5);

-- Seed IA2 Chapter 16
INSERT INTO public.topic_templates (course_short, chapter_number, topic_name, display_order) VALUES
('IA2', 16, 'Debt Investments (Amortized Cost)', 0),
('IA2', 16, 'Debt Investments (Fair Value Adjustments)', 1),
('IA2', 16, 'Equity Investments (FV-NI)', 2),
('IA2', 16, 'Equity Method Basics', 3),
('IA2', 16, 'Equity Method Complex / Excess Allocation', 4),
('IA2', 16, 'Investment Sale / Impairment', 5);

-- Seed IA2 Chapter 17
INSERT INTO public.topic_templates (course_short, chapter_number, topic_name, display_order) VALUES
('IA2', 17, '5-Step Model Allocation Problems', 0),
('IA2', 17, 'Point-in-Time vs Over-Time', 1),
('IA2', 17, 'Over-Time Revenue Calculations', 2),
('IA2', 17, 'Contract Modifications', 3),
('IA2', 17, 'Variable Consideration', 4),
('IA2', 17, 'Principal vs Agent / Special Cases', 5);

-- Seed IA2 Chapter 18
INSERT INTO public.topic_templates (course_short, chapter_number, topic_name, display_order) VALUES
('IA2', 18, 'Current vs Deferred Basics', 0),
('IA2', 18, 'Compute Tax Expense + Payable', 1),
('IA2', 18, 'Deferred Tax Journal Entries', 2),
('IA2', 18, 'Valuation Allowance', 3),
('IA2', 18, 'Net Operating Losses', 4),
('IA2', 18, 'Rate Changes + Revaluation', 5);

-- Seed IA2 Chapter 19
INSERT INTO public.topic_templates (course_short, chapter_number, topic_name, display_order) VALUES
('IA2', 19, 'Pension Expense Components', 0),
('IA2', 19, 'Employer Journal Entries', 1),
('IA2', 19, 'Funded Status Calculation', 2),
('IA2', 19, 'OCI / Prior Service Cost / G/L', 3),
('IA2', 19, 'Pension Worksheet Problems', 4),
('IA2', 19, 'Settlement / Curtailment', 5);

-- Seed IA2 Chapter 20
INSERT INTO public.topic_templates (course_short, chapter_number, topic_name, display_order) VALUES
('IA2', 20, 'Lease Classification', 0),
('IA2', 20, 'Present Value of Lease Payments', 1),
('IA2', 20, 'Lessee – Finance Lease', 2),
('IA2', 20, 'Lessee – Operating Lease', 3),
('IA2', 20, 'Lessor Accounting', 4),
('IA2', 20, 'Lease Modifications / Special Features', 5);

-- Seed IA2 Chapter 21
INSERT INTO public.topic_templates (course_short, chapter_number, topic_name, display_order) VALUES
('IA2', 21, 'Change in Estimate', 0),
('IA2', 21, 'Change in Principle (Retrospective)', 1),
('IA2', 21, 'Error Corrections', 2),
('IA2', 21, 'Depreciation Switch Problems', 3),
('IA2', 21, 'Inventory Method Changes', 4),
('IA2', 21, 'Disclosure / Statement Impact', 5);

-- Seed IA2 Chapter 22
INSERT INTO public.topic_templates (course_short, chapter_number, topic_name, display_order) VALUES
('IA2', 22, 'Operating Section (Indirect Method)', 0),
('IA2', 22, 'Working Capital Adjustments', 1),
('IA2', 22, 'Investing Activities', 2),
('IA2', 22, 'Financing Activities', 3),
('IA2', 22, 'Cash Flow Reconstruction Problems', 4),
('IA2', 22, 'Noncash Transactions / Special Items', 5);
