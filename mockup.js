import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Calculator, Wallet, HeartPulse, PiggyBank, Info, ChevronRight, RefreshCcw, Calendar, Building2, TrendingUp, Sparkles } from 'lucide-react';

// --- TAX DATA CONSTANTS ---
const TAX_DATA = {
    '2026': {
        label: '2026 (Mar 2025 - Feb 2026)',
        brackets: [
            { limit: 237100, rate: 0.18, base: 0 },
            { limit: 370500, rate: 0.26, base: 42678 },
            { limit: 512800, rate: 0.31, base: 77362 },
            { limit: 673000, rate: 0.36, base: 121475 },
            { limit: 857900, rate: 0.39, base: 179147 },
            { limit: 1817000, rate: 0.41, base: 251258 },
            { limit: Infinity, rate: 0.45, base: 644489 },
        ],
        rebates: {
            primary: 17235,
            secondary: 9444,
            tertiary: 3145,
        },
        medical: {
            main: 364,
            firstDep: 364,
            additional: 246,
        }
    },
    '2025': {
        label: '2025 (Mar 2024 - Feb 2025)',
        brackets: [
            { limit: 237100, rate: 0.18, base: 0 },
            { limit: 370500, rate: 0.26, base: 42678 },
            { limit: 512800, rate: 0.31, base: 77362 },
            { limit: 673000, rate: 0.36, base: 121475 },
            { limit: 857900, rate: 0.39, base: 179147 },
            { limit: 1817000, rate: 0.41, base: 251258 },
            { limit: Infinity, rate: 0.45, base: 644489 },
        ],
        rebates: {
            primary: 17235,
            secondary: 9444,
            tertiary: 3145,
        },
        medical: {
            main: 364,
            firstDep: 364,
            additional: 246,
        }
    },
    '2024': {
        label: '2024 (Mar 2023 - Feb 2024)',
        brackets: [
            { limit: 226000, rate: 0.18, base: 0 },
            { limit: 353100, rate: 0.26, base: 40680 },
            { limit: 488700, rate: 0.31, base: 73726 },
            { limit: 641400, rate: 0.36, base: 115763 },
            { limit: 817600, rate: 0.39, base: 170739 },
            { limit: 1731600, rate: 0.41, base: 239451 },
            { limit: Infinity, rate: 0.45, base: 614191 },
        ],
        rebates: {
            primary: 16425,
            secondary: 9000,
            tertiary: 2997,
        },
        medical: {
            main: 364,
            firstDep: 364,
            additional: 246,
        }
    }
};

// UIF Monthly Ceiling (Standard R17,712)
const UIF_CEILING = 17712;

// --- HELPER FUNCTIONS ---

// Core Tax Calculation Logic
const calculateAnnualTax = (annualGross, annualRetirementInput, age, taxYear, medAidMembers) => {
    const { brackets, rebates, medical } = TAX_DATA[taxYear];

    // 1. Calculate Allowable Retirement Deduction (Section 11F)
    const retirementCapPct = annualGross * 0.275;
    const retirementCapFixed = 350000;
    const allowableRetirement = Math.min(annualRetirementInput, retirementCapPct, retirementCapFixed);

    // 2. Taxable Income
    const taxableIncome = Math.max(0, annualGross - allowableRetirement);

    // 3. Normal Tax
    let normalTax = 0;
    for (let i = 0; i < brackets.length; i++) {
        const bracket = brackets[i];
        const prevLimit = i === 0 ? 0 : brackets[i - 1].limit;

        if (taxableIncome <= bracket.limit) {
            normalTax = bracket.base + ((taxableIncome - prevLimit) * bracket.rate);
            break;
        } else if (i === brackets.length - 1) {
            normalTax = bracket.base + ((taxableIncome - prevLimit) * bracket.rate);
        }
    }

    // 4. Rebates
    let totalRebate = rebates.primary;
    if (age >= 65) totalRebate += rebates.secondary;
    if (age >= 75) totalRebate += rebates.tertiary;

    // 5. Medical Credits
    let annualMedicalCredits = 0;
    if (medAidMembers > 0) {
        annualMedicalCredits += medical.main;
        if (medAidMembers > 1) annualMedicalCredits += medical.firstDep;
        if (medAidMembers > 2) annualMedicalCredits += (medAidMembers - 2) * medical.additional;
    }
    annualMedicalCredits *= 12;

    // 6. Final Tax
    const taxAfterRebates = Math.max(0, normalTax - totalRebate);
    const finalTaxPayable = Math.max(0, taxAfterRebates - annualMedicalCredits);

    return { finalTaxPayable, allowableRetirement, taxableIncome, totalRebate, annualMedicalCredits };
};

// Future Value Calculation (Compound Interest)
const calculateFutureValue = (monthlyContribution, currentAge, retirementAge = 65, annualReturnRate = 0.10) => {
    const yearsToGrow = retirementAge - currentAge;
    if (yearsToGrow <= 0) return 0;

    const months = yearsToGrow * 12;
    const monthlyRate = annualReturnRate / 12;

    // FV = PMT * (((1 + r)^n - 1) / r)
    const futureValue = monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    return futureValue;
};


// --- COMPONENTS ---

const Card = ({ children, className = "" }) => (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
        {children}
    </div>
);

const AmountDisplay = ({ label, amount, subtext, highlight = false, negative = false, small = false }) => (
    <div className={`p-4 rounded-xl ${highlight ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50'}`}>
        <div className="text-sm text-slate-500 font-medium mb-1">{label}</div>
        <div className={`${small ? 'text-xl' : 'text-2xl'} font-bold ${negative ? 'text-rose-600' : 'text-slate-900'}`}>
            {negative && '-'}R {amount.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
        </div>
        {subtext && <div className="text-xs text-slate-400 mt-1">{subtext}</div>}
    </div>
);

const InputGroup = ({ label, icon: Icon, children, helpText }) => (
    <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
            <label className="flex items-center text-sm font-semibold text-slate-700">
                <Icon className="w-4 h-4 mr-2 text-blue-600" />
                {label}
            </label>
            {helpText && (
                <div className="group relative">
                    <Info className="w-4 h-4 text-slate-300 cursor-help" />
                    <div className="absolute right-0 bottom-6 w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {helpText}
                    </div>
                </div>
            )}
        </div>
        {children}
    </div>
);

const SmartAdvice = ({ age, currentTax, currentGross, currentRetirement, taxYear, medAidMembers }) => {
    if (age >= 65) return null; // Logic usually applies to accumulation phase

    // Scenario 1: Add R1000/pm
    const scenario1_Additional = 1000 * 12;
    const scenario1_TotalRetirement = currentRetirement + scenario1_Additional;
    const scenario1_Result = calculateAnnualTax(currentGross, scenario1_TotalRetirement, age, taxYear, medAidMembers);
    const scenario1_TaxSaved = currentTax - scenario1_Result.finalTaxPayable;
    const scenario1_FV = calculateFutureValue(1000, age);

    // Scenario 2: Add R2000/pm
    const scenario2_Additional = 2000 * 12;
    const scenario2_TotalRetirement = currentRetirement + scenario2_Additional;
    const scenario2_Result = calculateAnnualTax(currentGross, scenario2_TotalRetirement, age, taxYear, medAidMembers);
    const scenario2_TaxSaved = currentTax - scenario2_Result.finalTaxPayable;
    const scenario2_FV = calculateFutureValue(2000, age);

    return (
        <Card className="mt-8 border-indigo-100 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-6 text-white">
                <div className="flex items-center space-x-3 mb-2">
                    <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                        <Sparkles className="w-5 h-5 text-yellow-300" />
                    </div>
                    <h3 className="text-xl font-bold">Smart Optimization Advice</h3>
                </div>
                <p className="text-indigo-100 opacity-90 max-w-2xl">
                    See how contributing a little more to your retirement annuity can lower your tax bill now and grow your wealth for later.
                </p>
            </div>

            <div className="p-6 bg-indigo-50/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Option 1 */}
                    <div className="bg-white p-5 rounded-xl border border-indigo-100 shadow-sm relative group hover:border-indigo-300 transition-all">
                        <div className="absolute top-0 right-0 bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-bl-xl">
                            OPTION A
                        </div>
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="bg-indigo-50 p-2 rounded-full">
                                <TrendingUp className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="font-bold text-slate-800">Contribute +R1,000 pm</div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Annual Tax Saved</div>
                                <div className="text-2xl font-bold text-emerald-600">
                                    R {scenario1_TaxSaved.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                                </div>
                                <div className="text-xs text-slate-400">Extra refund from SARS</div>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Value at Age 65</div>
                                <div className="text-xl font-bold text-indigo-900">
                                    R {scenario1_FV.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                                </div>
                                <div className="text-xs text-slate-400">Estimated capital (10% growth)</div>
                            </div>
                        </div>
                    </div>

                    {/* Option 2 */}
                    <div className="bg-white p-5 rounded-xl border border-indigo-100 shadow-sm relative group hover:border-indigo-300 transition-all">
                        <div className="absolute top-0 right-0 bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-bl-xl">
                            OPTION B
                        </div>
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="bg-indigo-50 p-2 rounded-full">
                                <TrendingUp className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="font-bold text-slate-800">Contribute +R2,000 pm</div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Annual Tax Saved</div>
                                <div className="text-2xl font-bold text-emerald-600">
                                    R {scenario2_TaxSaved.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                                </div>
                                <div className="text-xs text-slate-400">Extra refund from SARS</div>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Value at Age 65</div>
                                <div className="text-xl font-bold text-indigo-900">
                                    R {scenario2_FV.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                                </div>
                                <div className="text-xs text-slate-400">Estimated capital (10% growth)</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-4 flex items-start space-x-2">
                    <Info className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-indigo-400">
                        Projections assume a 10% annual nominal growth rate compounded monthly. Inflation and fund fees are not factored into this simple illustration. Tax savings are based on your current marginal tax rate and available limits.
                    </p>
                </div>
            </div>
        </Card>
    );
};

export default function App() {
    // --- STATE ---
    const [taxYear, setTaxYear] = useState('2026');
    const [period, setPeriod] = useState('monthly'); // 'monthly' or 'yearly'
    const [grossIncome, setGrossIncome] = useState(35000);
    const [age, setAge] = useState(30);
    const [retirementContrib, setRetirementContrib] = useState(0); // Value in Rands
    const [medAidMembers, setMedAidMembers] = useState(0);

    // --- CALCULATIONS ---

    const results = useMemo(() => {
        // 1. Annualise Inputs
        const annualGross = period === 'monthly' ? grossIncome * 12 : grossIncome;
        const monthlyGross = annualGross / 12;
        const annualRetirementInput = period === 'monthly' ? retirementContrib * 12 : retirementContrib;

        // 2. Run Main Tax Calculation
        const taxResults = calculateAnnualTax(annualGross, annualRetirementInput, age, taxYear, medAidMembers);

        // 3. UIF Calculation
        const monthlyUIF = Math.min(monthlyGross, UIF_CEILING) * 0.01;
        const annualUIF = monthlyUIF * 12;

        // 4. SDL Calculation
        const annualSDL = annualGross * 0.01;

        // 5. Net Pay
        const annualNetPay = annualGross - taxResults.finalTaxPayable - annualRetirementInput - annualUIF;

        // 6. Savings Calculation (Existing RA vs No RA)
        const taxResultsNoRA = calculateAnnualTax(annualGross, 0, age, taxYear, medAidMembers);
        const taxSaved = taxResultsNoRA.finalTaxPayable - taxResults.finalTaxPayable;

        return {
            annualGross,
            ...taxResults,
            annualNetPay,
            taxSaved,
            annualUIF,
            annualSDL,
            annualRetirementInput // Passed for Advice Component
        };
    }, [grossIncome, period, age, retirementContrib, medAidMembers, taxYear]);

    // Chart Data
    const chartData = [
        { name: 'Net Pay', value: results.annualNetPay, color: '#10b981' }, // emerald-500
        { name: 'Tax', value: results.finalTaxPayable, color: '#3b82f6' },   // blue-500
        { name: 'Pension', value: results.allowableRetirement, color: '#f59e0b' }, // amber-500
        { name: 'UIF', value: results.annualUIF, color: '#6366f1' } // indigo-500
    ].filter(d => d.value > 0);

    return (
        <div className="min-h-screen bg-slate-100 font-sans text-slate-900 pb-12">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Calculator className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-slate-800">Tax<span className="text-blue-600">Smart</span></span>
                    </div>
                    <div className="text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                        {TAX_DATA[taxYear].label}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT COLUMN: INPUTS */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                                <span className="w-1 h-6 bg-blue-600 rounded-full mr-3"></span>
                                Your Details
                            </h2>

                            {/* Tax Year Selector */}
                            <InputGroup label="Tax Year" icon={Calendar} helpText="Select the financial year you want to calculate for (1 March - 28 February).">
                                <div className="relative">
                                    <select
                                        value={taxYear}
                                        onChange={(e) => setTaxYear(e.target.value)}
                                        className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-semibold text-slate-800 appearance-none"
                                    >
                                        <option value="2026">2026 (Mar '25 - Feb '26)</option>
                                        <option value="2025">2025 (Mar '24 - Feb '25)</option>
                                        <option value="2024">2024 (Mar '23 - Feb '24)</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                                        <ChevronRight className="w-5 h-5 rotate-90" />
                                    </div>
                                </div>
                            </InputGroup>

                            {/* Period Toggle */}
                            <div className="bg-slate-100 p-1 rounded-lg flex mb-8">
                                <button
                                    onClick={() => setPeriod('monthly')}
                                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${period === 'monthly' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Monthly
                                </button>
                                <button
                                    onClick={() => setPeriod('yearly')}
                                    className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${period === 'yearly' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Yearly
                                </button>
                            </div>

                            {/* Income */}
                            <InputGroup label="Gross Income" icon={Wallet} helpText="Your total earnings before any deductions.">
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R</div>
                                    <input
                                        type="number"
                                        value={grossIncome}
                                        onChange={(e) => setGrossIncome(Number(e.target.value))}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-semibold text-slate-800"
                                        placeholder="0"
                                    />
                                </div>
                            </InputGroup>

                            {/* Age */}
                            <InputGroup label="Age" icon={RefreshCcw} helpText="Age determines your primary, secondary, or tertiary tax rebate.">
                                <div className="space-y-4">
                                    <div className="flex justify-between text-xs text-slate-400 font-medium px-1">
                                        <span>Under 65</span>
                                        <span>65-74</span>
                                        <span>75+</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="18"
                                        max="85"
                                        value={age}
                                        onChange={(e) => setAge(Number(e.target.value))}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <div className="text-center font-bold text-blue-600 bg-blue-50 py-1 rounded-md">{age} Years Old</div>
                                </div>
                            </InputGroup>

                            {/* Retirement */}
                            <InputGroup label="Pension / RA Contribution" icon={PiggyBank} helpText="Contributions to Pension, Provident, or Retirement Annuity funds reduce your taxable income (up to limits).">
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R</div>
                                    <input
                                        type="number"
                                        value={retirementContrib}
                                        onChange={(e) => setRetirementContrib(Number(e.target.value))}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-semibold text-slate-800"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="mt-2 text-xs text-slate-500">
                                    Limit: 27.5% of income or R350k/year. We calculate this automatically.
                                </div>
                            </InputGroup>

                            {/* Medical Aid */}
                            <InputGroup label="Medical Aid Members" icon={HeartPulse} helpText="Total number of people on your medical aid plan (Main member + dependents).">
                                <div className="flex items-center space-x-4">
                                    <button
                                        onClick={() => setMedAidMembers(Math.max(0, medAidMembers - 1))}
                                        className="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-500 hover:border-blue-500 hover:text-blue-500 transition-colors font-bold text-lg"
                                    >
                                        -
                                    </button>
                                    <div className="flex-1 text-center font-bold text-xl text-slate-800">
                                        {medAidMembers}
                                    </div>
                                    <button
                                        onClick={() => setMedAidMembers(medAidMembers + 1)}
                                        className="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-500 hover:border-blue-500 hover:text-blue-500 transition-colors font-bold text-lg"
                                    >
                                        +
                                    </button>
                                </div>
                            </InputGroup>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: RESULTS */}
                    <div className="lg:col-span-7 space-y-6">

                        {/* Main Result Card */}
                        <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white border-none shadow-xl">
                            <div className="p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-blue-100 font-medium mb-1">Estimated Net Pay</h3>
                                        <div className="text-5xl font-bold tracking-tight">
                                            R {(results.annualNetPay / 12).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                                            <span className="text-lg font-normal text-blue-200 ml-2">/ month</span>
                                        </div>
                                    </div>
                                    <div className="bg-white/10 p-3 rounded-lg backdrop-blur-sm">
                                        <Wallet className="w-8 h-8 text-blue-200" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
                                    <div>
                                        <div className="text-blue-200 text-sm mb-1">Annual Net Pay</div>
                                        <div className="text-xl font-semibold">R {results.annualNetPay.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</div>
                                    </div>
                                    <div>
                                        <div className="text-blue-200 text-sm mb-1">Total Tax</div>
                                        <div className="text-xl font-semibold">R {results.finalTaxPayable.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</div>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Tax Savings Alert */}
                        {results.taxSaved > 0 && (
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start space-x-4">
                                <div className="bg-emerald-100 p-2 rounded-full">
                                    <PiggyBank className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-emerald-800">Smart Saving!</h4>
                                    <p className="text-sm text-emerald-700 mt-1">
                                        Your retirement contributions saved you <span className="font-bold">R {results.taxSaved.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</span> in tax this year!
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Visual Breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-6">
                                <h3 className="text-slate-800 font-bold mb-6">Salary Breakdown</h3>
                                <div className="h-48 flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={chartData}
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value) => `R ${value.toLocaleString()}`} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            <Card className="p-6">
                                <h3 className="text-slate-800 font-bold mb-4">Detailed Calculation</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Taxable Income</span>
                                        <span className="font-medium">R {results.taxableIncome.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Tax Before Rebates</span>
                                        <span className="font-medium">R {(results.finalTaxPayable + results.totalRebate + results.annualMedicalCredits).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-emerald-600">
                                        <span>Age Rebate</span>
                                        <span>- R {results.totalRebate.toLocaleString()}</span>
                                    </div>
                                    {results.annualMedicalCredits > 0 && (
                                        <div className="flex justify-between text-sm text-emerald-600">
                                            <span>Medical Credits</span>
                                            <span>- R {results.annualMedicalCredits.toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className="h-px bg-slate-100 my-2"></div>
                                    <div className="flex justify-between text-base font-bold text-slate-800">
                                        <span>Tax Due (PAYE)</span>
                                        <span>R {results.finalTaxPayable.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-indigo-600 font-medium">
                                        <span>UIF Contribution (1%)</span>
                                        <span>R {results.annualUIF.toLocaleString()}</span>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-dashed border-slate-200">
                                        <div className="flex justify-between text-xs text-slate-400">
                                            <span className="flex items-center"><Building2 className="w-3 h-3 mr-1" /> Employer SDL (1%)</span>
                                            <span>R {results.annualSDL.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Monthly Summary */}
                        <Card className="p-6">
                            <h3 className="text-slate-800 font-bold mb-4 flex items-center">
                                <span className="w-1 h-6 bg-slate-800 rounded-full mr-3"></span>
                                Monthly Slip View
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <AmountDisplay
                                    label="Gross Income"
                                    amount={results.annualGross / 12}
                                    small
                                />
                                <AmountDisplay
                                    label="PAYE (Tax)"
                                    amount={results.finalTaxPayable / 12}
                                    negative
                                    small
                                />
                                <AmountDisplay
                                    label="UIF"
                                    amount={results.annualUIF / 12}
                                    negative
                                    small
                                />
                                <AmountDisplay
                                    label="Take Home"
                                    amount={results.annualNetPay / 12}
                                    highlight
                                    small
                                />
                            </div>
                        </Card>

                        {/* Smart Advice Section */}
                        <SmartAdvice
                            age={age}
                            currentTax={results.finalTaxPayable}
                            currentGross={results.annualGross}
                            currentRetirement={results.annualRetirementInput}
                            taxYear={taxYear}
                            medAidMembers={medAidMembers}
                        />

                    </div>
                </div>
            </div>
        </div>
    );
}