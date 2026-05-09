# Bilingual Laws JSON Integrity Audit Report

Generated on: `2026-05-07T04:16:28.319Z`  
Target Folder: `D:\Downloads\NepalLaw\data\laws_json`  

## Executive Summary

- **Total Acts Audited**: 27
- **Grand Total Sections**: 2591
- **Fully Aligned Bilingual Sections**: 2468 (95.3%)
- **English-only Sections (Missing Nepali)**: 45
- **Nepali-only Sections (Missing English)**: 78

> [!WARNING]
> ⚠️ **Alignment Discrepancies Found!** There are sections containing only one language, resulting in an overall alignment score of 95.3%. See detailed analysis below to audit specific sections.

## Act Parity Leaderboard

| Rank | Act Identifier | Total Sections | Bilingual Sections | English Only | Nepali Only | Parity Score |
|------|----------------|:--------------:|:------------------:|:------------:|:-----------:|:------------:|
| 1 | [`social_security_act_2074`](file:///d:/Downloads/NepalLaw/data/laws_json/social_security_act_2074.json) | 73 | 40 | 0 | 33 | **54.8%** |
| 2 | [`nrn_rules_2066`](file:///d:/Downloads/NepalLaw/data/laws_json/nrn_rules_2066.json) | 37 | 26 | 7 | 4 | **70.3%** |
| 3 | [`mlpa_2063`](file:///d:/Downloads/NepalLaw/data/laws_json/mlpa_2063.json) | 132 | 100 | 16 | 16 | **75.8%** |
| 4 | [`nrb_act_2058`](file:///d:/Downloads/NepalLaw/data/laws_json/nrb_act_2058.json) | 151 | 133 | 5 | 13 | **88.1%** |
| 5 | [`constitution_2072`](file:///d:/Downloads/NepalLaw/data/laws_json/constitution_2072.json) | 327 | 315 | 9 | 3 | **96.3%** |
| 6 | [`bonus_act_2030`](file:///d:/Downloads/NepalLaw/data/laws_json/bonus_act_2030.json) | 30 | 29 | 1 | 0 | **96.7%** |
| 7 | [`cooperatives_act_2074`](file:///d:/Downloads/NepalLaw/data/laws_json/cooperatives_act_2074.json) | 156 | 151 | 1 | 4 | **96.8%** |
| 8 | [`income_tax_act_2058`](file:///d:/Downloads/NepalLaw/data/laws_json/income_tax_act_2058.json) | 161 | 157 | 2 | 2 | **97.5%** |
| 9 | [`industrial_enterprises_act_2076`](file:///d:/Downloads/NepalLaw/data/laws_json/industrial_enterprises_act_2076.json) | 81 | 79 | 1 | 1 | **97.5%** |
| 10 | [`foreign_exchange_act_2019`](file:///d:/Downloads/NepalLaw/data/laws_json/foreign_exchange_act_2019.json) | 49 | 48 | 0 | 1 | **98.0%** |
| 11 | [`labour_act_2074`](file:///d:/Downloads/NepalLaw/data/laws_json/labour_act_2074.json) | 186 | 184 | 1 | 1 | **98.9%** |
| 12 | [`insurance_act_2079`](file:///d:/Downloads/NepalLaw/data/laws_json/insurance_act_2079.json) | 175 | 174 | 1 | 0 | **99.4%** |
| 13 | [`companies_act_2063`](file:///d:/Downloads/NepalLaw/data/laws_json/companies_act_2063.json) | 192 | 191 | 1 | 0 | **99.5%** |
| 14 | [`arbitration_act_2055`](file:///d:/Downloads/NepalLaw/data/laws_json/arbitration_act_2055.json) | 46 | 46 | 0 | 0 | **100.0%** |
| 15 | [`audit_act_2075`](file:///d:/Downloads/NepalLaw/data/laws_json/audit_act_2075.json) | 31 | 31 | 0 | 0 | **100.0%** |
| 16 | [`bafia_2073`](file:///d:/Downloads/NepalLaw/data/laws_json/bafia_2073.json) | 137 | 137 | 0 | 0 | **100.0%** |
| 17 | [`banking_offence_act_2064`](file:///d:/Downloads/NepalLaw/data/laws_json/banking_offence_act_2064.json) | 35 | 35 | 0 | 0 | **100.0%** |
| 18 | [`ca_act_2053`](file:///d:/Downloads/NepalLaw/data/laws_json/ca_act_2053.json) | 59 | 59 | 0 | 0 | **100.0%** |
| 19 | [`contract_act_2056`](file:///d:/Downloads/NepalLaw/data/laws_json/contract_act_2056.json) | 91 | 91 | 0 | 0 | **100.0%** |
| 20 | [`ecommerce_act_2081`](file:///d:/Downloads/NepalLaw/data/laws_json/ecommerce_act_2081.json) | 39 | 39 | 0 | 0 | **100.0%** |
| 21 | [`fitta_act_2075`](file:///d:/Downloads/NepalLaw/data/laws_json/fitta_act_2075.json) | 55 | 55 | 0 | 0 | **100.0%** |
| 22 | [`immigration_act_2049`](file:///d:/Downloads/NepalLaw/data/laws_json/immigration_act_2049.json) | 20 | 20 | 0 | 0 | **100.0%** |
| 23 | [`insolvency_act_2063`](file:///d:/Downloads/NepalLaw/data/laws_json/insolvency_act_2063.json) | 79 | 79 | 0 | 0 | **100.0%** |
| 24 | [`international_financial_act_2054`](file:///d:/Downloads/NepalLaw/data/laws_json/international_financial_act_2054.json) | 25 | 25 | 0 | 0 | **100.0%** |
| 25 | [`nrn_act_2064`](file:///d:/Downloads/NepalLaw/data/laws_json/nrn_act_2064.json) | 19 | 19 | 0 | 0 | **100.0%** |
| 26 | [`public_procurement_act_2063`](file:///d:/Downloads/NepalLaw/data/laws_json/public_procurement_act_2063.json) | 84 | 84 | 0 | 0 | **100.0%** |
| 27 | [`securities_act_2063`](file:///d:/Downloads/NepalLaw/data/laws_json/securities_act_2063.json) | 121 | 121 | 0 | 0 | **100.0%** |

## Detailed Discrepancy Analysis

This section highlights acts with a parity score of less than 100% and lists the specific section IDs that are missing translation fields.

### 📄 SOCIAL SECURITY (`social_security_act_2074`)

- **Parity Score**: 54.8% (40 / 73 sections)
- 🔵 **Missing English Translation** in 33 sections:
  `sec_38, sec_39, sec_40, sec_41, sec_42, sec_43, sec_44, sec_45, sec_46, sec_47, sec_48, sec_49, sec_50, sec_51, sec_52, sec_53, sec_54, sec_55, sec_56, sec_57, sec_58, sec_59, sec_60, sec_61, sec_62, sec_63, sec_64, sec_65, sec_66, sec_67, sec_68, sec_69, sec_70`

---

### 📄 NRN RULES (`nrn_rules_2066`)

- **Parity Score**: 70.3% (26 / 37 sections)
- 🔴 **Missing Nepali Translation** in 7 sections:
  `part, part_1, sch_5, part_2, part_3, part_4, part_5`
- 🔵 **Missing English Translation** in 4 sections:
  `section, section_1, annex_1, annex_2`

---

### 📄 MLPA (`mlpa_2063`)

- **Parity Score**: 75.8% (100 / 132 sections)
- 🔴 **Missing Nepali Translation** in 16 sections:
  `sec_7k, sec_7l, sec_7m, sec_7n, sec_7o, sec_7p, sec_7q, sec_7r, sec_7s, sec_7t, sec_7u, sec_7v, sec_7w, sec_7x, sec_29k, associated_offences`
- 🔵 **Missing English Translation** in 16 sections:
  `sec_7_1, sec_7_2, sec_7_3, sec_7_4, sec_7_5, sec_7_6, sec_7_7, sec_7_8, sec_7_9, sec_7_10, sec_7_11, sec_7_12, sec_7_13, sec_7_14, sec_29_1, section`

---

### 📄 NRB (`nrb_act_2058`)

- **Parity Score**: 88.1% (133 / 151 sections)
- 🔴 **Missing Nepali Translation** in 5 sections:
  `sec_88k, sec_88l, sec_88m, sec_88n, sec_88o`
- 🔵 **Missing English Translation** in 13 sections:
  `sec_72, sec_83, sec_86j, sec_86_1, sec_86_2, sec_86_3, sec_88j, sec_88_1, sec_88_2, sec_88_3, sec_88_4, sec_88_5, sec_100a`

---

### 📄 CONSTITUTION (`constitution_2072`)

- **Parity Score**: 96.3% (315 / 327 sections)
- 🔴 **Missing Nepali Translation** in 9 sections:
  `sec_224, art_242_1, sec_1, sec_2, sec_3, sec_4, sec_5, sec_6, sec_7`
- 🔵 **Missing English Translation** in 3 sections:
  `art_209, art_224, sch_4`

---

### 📄 BONUS (`bonus_act_2030`)

- **Parity Score**: 96.7% (29 / 30 sections)
- 🔴 **Missing Nepali Translation** in 1 sections:
  `sec_23`

---

### 📄 COOPERATIVES (`cooperatives_act_2074`)

- **Parity Score**: 96.8% (151 / 156 sections)
- 🔴 **Missing Nepali Translation** in 1 sections:
  `sec_135`
- 🔵 **Missing English Translation** in 4 sections:
  `sec_53, sec_74, sec_75, sec_1_1`

---

### 📄 INCOME TAX (`income_tax_act_2058`)

- **Parity Score**: 97.5% (157 / 161 sections)
- 🔴 **Missing Nepali Translation** in 2 sections:
  `rates_of_tax, assessment_of_depreciation`
- 🔵 **Missing English Translation** in 2 sections:
  `section, section_1`

---

### 📄 INDUSTRIAL ENTERPRISES (`industrial_enterprises_act_2076`)

- **Parity Score**: 97.5% (79 / 81 sections)
- 🔴 **Missing Nepali Translation** in 1 sections:
  `sch_6`
- 🔵 **Missing English Translation** in 1 sections:
  `sec_6_1`

---

### 📄 FOREIGN EXCHANGE (`foreign_exchange_act_2019`)

- **Parity Score**: 98.0% (48 / 49 sections)
- 🔵 **Missing English Translation** in 1 sections:
  `sec_11h`

---

### 📄 LABOUR (`labour_act_2074`)

- **Parity Score**: 98.9% (184 / 186 sections)
- 🔴 **Missing Nepali Translation** in 1 sections:
  `sec_61`
- 🔵 **Missing English Translation** in 1 sections:
  `sec_6_1`

---

### 📄 INSURANCE (`insurance_act_2079`)

- **Parity Score**: 99.4% (174 / 175 sections)
- 🔴 **Missing Nepali Translation** in 1 sections:
  `chap_1`

---

### 📄 COMPANIES (`companies_act_2063`)

- **Parity Score**: 99.5% (191 / 192 sections)
- 🔴 **Missing Nepali Translation** in 1 sections:
  `preamble`

---

