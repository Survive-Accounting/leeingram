
-- Create topic_rules table
CREATE TABLE public.topic_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_short TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  topic_name TEXT NOT NULL,
  pattern TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  match_field TEXT NOT NULL DEFAULT 'problem_text',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.topic_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read topic_rules" ON public.topic_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write topic_rules" ON public.topic_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update topic_rules" ON public.topic_rules FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete topic_rules" ON public.topic_rules FOR DELETE TO authenticated USING (true);

-- Add fields to lw_items
ALTER TABLE public.lw_items ADD COLUMN IF NOT EXISTS needs_topic_review BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.lw_items ADD COLUMN IF NOT EXISTS topic_locked BOOLEAN NOT NULL DEFAULT false;

-- Seed topic_rules for IA2
-- Chapter 13: Long-Term Liabilities
INSERT INTO public.topic_rules (course_short, chapter_number, topic_name, pattern, priority, match_field) VALUES
('IA2', 13, 'Bond Issue Entries', 'bond.*(issue|issu)', 10, 'problem_text'),
('IA2', 13, 'Bond Issue Entries', 'record.*(bond|issuance)', 8, 'problem_text'),
('IA2', 13, 'Interest + Amortization (Effective Interest)', 'effective.interest', 10, 'problem_text'),
('IA2', 13, 'Interest + Amortization (Effective Interest)', 'amortiz.*(premium|discount)', 9, 'problem_text'),
('IA2', 13, 'Interest + Amortization (Effective Interest)', 'interest.*(expense|payment)', 7, 'problem_text'),
('IA2', 13, 'Amortization Table Problems', 'amortization.*(table|schedule)', 10, 'problem_text'),
('IA2', 13, 'Bond Retirement / Redemption', '(retire|redeem|call).*(bond)', 10, 'problem_text'),
('IA2', 13, 'Bond Retirement / Redemption', 'gain.*(redemption|retirement)', 8, 'problem_text'),
('IA2', 13, 'Debt Settlement', 'debt.*(settle|settlement)', 10, 'problem_text'),
('IA2', 13, 'Troubled Debt Restructuring / Term Modifications', 'troubled.debt', 10, 'problem_text'),
('IA2', 13, 'Troubled Debt Restructuring / Term Modifications', '(restructur|modification).*(debt|term|loan)', 9, 'problem_text');

-- Chapter 14: Stockholder's Equity
INSERT INTO public.topic_rules (course_short, chapter_number, topic_name, pattern, priority, match_field) VALUES
('IA2', 14, 'Common Stock Issuance', 'common.stock.*(issue|issu)', 10, 'problem_text'),
('IA2', 14, 'Common Stock Issuance', '(issue|sell).*(common|shares)', 8, 'problem_text'),
('IA2', 14, 'Preferred Stock Problems', 'preferred.stock', 10, 'problem_text'),
('IA2', 14, 'Treasury Stock (Cost Method)', 'treasury.stock', 10, 'problem_text'),
('IA2', 14, 'Treasury Stock (Cost Method)', 'cost.method.*(treasury|repurchase)', 8, 'problem_text'),
('IA2', 14, 'Dividends (Cash, Stock, Splits)', '(cash|stock).dividend', 10, 'problem_text'),
('IA2', 14, 'Dividends (Cash, Stock, Splits)', 'stock.split', 10, 'problem_text'),
('IA2', 14, 'Retained Earnings / Prior Period Adjustments', 'retained.earnings', 10, 'problem_text'),
('IA2', 14, 'Retained Earnings / Prior Period Adjustments', 'prior.period', 9, 'problem_text'),
('IA2', 14, 'Equity Rollforward / Statement Problems', '(equity|stockholder).*(rollforward|statement)', 10, 'problem_text');

-- Chapter 15: Dilutive Securities and EPS
INSERT INTO public.topic_rules (course_short, chapter_number, topic_name, pattern, priority, match_field) VALUES
('IA2', 15, 'Basic EPS', 'basic.*(eps|earnings.per.share)', 10, 'problem_text'),
('IA2', 15, 'Weighted Average Shares', 'weighted.average.*(share|outstanding)', 10, 'problem_text'),
('IA2', 15, 'Stock Options / Treasury Stock Method', 'stock.option', 10, 'problem_text'),
('IA2', 15, 'Stock Options / Treasury Stock Method', 'treasury.stock.method', 10, 'problem_text'),
('IA2', 15, 'Convertible Bonds (If-Converted)', 'convertible.bond', 10, 'problem_text'),
('IA2', 15, 'Convertible Bonds (If-Converted)', 'if.converted', 10, 'problem_text'),
('IA2', 15, 'Convertible Preferred Stock', 'convertible.preferred', 10, 'problem_text'),
('IA2', 15, 'Dilution Decision Rules', 'dilut.*(decision|antidilut|test)', 10, 'problem_text');

-- Chapter 16: Investments
INSERT INTO public.topic_rules (course_short, chapter_number, topic_name, pattern, priority, match_field) VALUES
('IA2', 16, 'Debt Investments (Amortized Cost)', 'debt.invest.*(amortized|held.to.maturity)', 10, 'problem_text'),
('IA2', 16, 'Debt Investments (Fair Value Adjustments)', 'debt.invest.*(fair.value|fv)', 10, 'problem_text'),
('IA2', 16, 'Equity Investments (FV-NI)', '(equity|stock).invest.*(fv.ni|fair.value.*net.income)', 10, 'problem_text'),
('IA2', 16, 'Equity Method Basics', 'equity.method', 10, 'problem_text'),
('IA2', 16, 'Equity Method Complex / Excess Allocation', '(excess|goodwill).*(equity|allocation)', 10, 'problem_text'),
('IA2', 16, 'Investment Sale / Impairment', '(sale|sell|impair).*(invest)', 10, 'problem_text');

-- Chapter 17: Revenue Recognition
INSERT INTO public.topic_rules (course_short, chapter_number, topic_name, pattern, priority, match_field) VALUES
('IA2', 17, '5-Step Model Allocation Problems', '(5.step|five.step|transaction.price.*(allocat))', 10, 'problem_text'),
('IA2', 17, 'Point-in-Time vs Over-Time', 'point.in.time|over.time', 10, 'problem_text'),
('IA2', 17, 'Over-Time Revenue Calculations', '(percent.*complet|cost.to.cost|input.method)', 10, 'problem_text'),
('IA2', 17, 'Contract Modifications', 'contract.modif', 10, 'problem_text'),
('IA2', 17, 'Variable Consideration', 'variable.consider', 10, 'problem_text'),
('IA2', 17, 'Principal vs Agent / Special Cases', '(principal.*agent|consignment|bill.and.hold)', 10, 'problem_text');

-- Chapter 18: Income Taxes
INSERT INTO public.topic_rules (course_short, chapter_number, topic_name, pattern, priority, match_field) VALUES
('IA2', 18, 'Current vs Deferred Basics', '(current.*deferred|temporary.differ|permanent.differ)', 10, 'problem_text'),
('IA2', 18, 'Compute Tax Expense + Payable', '(tax.expense|income.tax.payable|taxable.income)', 10, 'problem_text'),
('IA2', 18, 'Deferred Tax Journal Entries', 'deferred.tax.*(asset|liability|journal|entry)', 10, 'problem_text'),
('IA2', 18, 'Valuation Allowance', 'valuation.allowance', 10, 'problem_text'),
('IA2', 18, 'Net Operating Losses', '(net.operating.loss|nol|loss.carryforward)', 10, 'problem_text'),
('IA2', 18, 'Rate Changes + Revaluation', '(rate.change|enacted.rate|tax.rate.*(change|adjust))', 10, 'problem_text');

-- Chapter 19: Pensions
INSERT INTO public.topic_rules (course_short, chapter_number, topic_name, pattern, priority, match_field) VALUES
('IA2', 19, 'Pension Expense Components', 'pension.expense|service.cost|interest.cost.*pension', 10, 'problem_text'),
('IA2', 19, 'Employer Journal Entries', '(employer|company).*(pension|journal).*entry', 10, 'problem_text'),
('IA2', 19, 'Funded Status Calculation', 'funded.status|pbo.*plan.asset', 10, 'problem_text'),
('IA2', 19, 'OCI / Prior Service Cost / G/L', '(oci|prior.service.cost|actuarial.gain|actuarial.loss|corridor)', 10, 'problem_text'),
('IA2', 19, 'Pension Worksheet Problems', 'pension.worksheet', 10, 'problem_text'),
('IA2', 19, 'Settlement / Curtailment', '(settlement|curtailment).*pension', 10, 'problem_text');

-- Chapter 20: Leases
INSERT INTO public.topic_rules (course_short, chapter_number, topic_name, pattern, priority, match_field) VALUES
('IA2', 20, 'Lease Classification', 'lease.classif|finance.*lease.*operat|bright.line', 10, 'problem_text'),
('IA2', 20, 'Present Value of Lease Payments', 'present.value.*(lease|payment)|pv.*(lease)', 10, 'problem_text'),
('IA2', 20, 'Lessee – Finance Lease', 'lessee.*(finance|capital)', 10, 'problem_text'),
('IA2', 20, 'Lessee – Operating Lease', 'lessee.*operating', 10, 'problem_text'),
('IA2', 20, 'Lessor Accounting', 'lessor|sales.type.lease|direct.financing', 10, 'problem_text'),
('IA2', 20, 'Lease Modifications / Special Features', 'lease.modif|residual.value|bargain.purchase', 10, 'problem_text');

-- Chapter 21: Accounting Changes
INSERT INTO public.topic_rules (course_short, chapter_number, topic_name, pattern, priority, match_field) VALUES
('IA2', 21, 'Change in Estimate', 'change.in.estimate|useful.life.*(change|revise)', 10, 'problem_text'),
('IA2', 21, 'Change in Principle (Retrospective)', 'change.in.*(principle|accounting.principle)|retrospective', 10, 'problem_text'),
('IA2', 21, 'Error Corrections', 'error.correct|prior.period.error|restate', 10, 'problem_text'),
('IA2', 21, 'Depreciation Switch Problems', 'depreciation.*(switch|change|method)', 10, 'problem_text'),
('IA2', 21, 'Inventory Method Changes', 'inventory.*(change|method|fifo|lifo|average)', 10, 'problem_text'),
('IA2', 21, 'Disclosure / Statement Impact', '(disclosure|statement).*(impact|effect|restate)', 10, 'problem_text');

-- Chapter 22: Statement of Cash Flows
INSERT INTO public.topic_rules (course_short, chapter_number, topic_name, pattern, priority, match_field) VALUES
('IA2', 22, 'Operating Section (Indirect Method)', '(operating|indirect).*(section|method|cash)', 10, 'problem_text'),
('IA2', 22, 'Working Capital Adjustments', 'working.capital|current.asset.*(change|adjust)|current.liab.*(change|adjust)', 10, 'problem_text'),
('IA2', 22, 'Investing Activities', 'investing.activ', 10, 'problem_text'),
('IA2', 22, 'Financing Activities', 'financing.activ', 10, 'problem_text'),
('IA2', 22, 'Cash Flow Reconstruction Problems', 'cash.flow.*(reconstruct|determine|compute)', 10, 'problem_text'),
('IA2', 22, 'Noncash Transactions / Special Items', '(noncash|non.cash|supplement|significant.noncash)', 10, 'problem_text');
