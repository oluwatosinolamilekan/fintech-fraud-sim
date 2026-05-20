import type { CountryProfile, GenerationPlugin } from './types.js';
import { normalizeCountry } from './utils.js';

const builtInProfiles: Record<string, CountryProfile> = {
  NG: {
    code: 'NG',
    label: 'Nigeria',
    currency: 'NGN',
    channels: ['mobile_app', 'web', 'api', 'pos', 'ussd'],
    paymentRails: ['bank_transfer', 'wallet_transfer', 'card', 'mobile_money', 'cashout'],
    accountTypes: ['wallet', 'savings', 'current'],
    beneficiaryTypes: ['bank_account', 'wallet', 'card', 'mobile_money'],
    merchantCategories: ['airtime', 'bill_payments', 'ecommerce', 'gaming', 'groceries', 'travel'],
    identityTypes: ['bvn_like_id', 'national_id', 'passport'],
    kycProviders: ['synthetic_bvn_check', 'synthetic_national_id_check'],
    bankCodeLength: 3
  },
  US: {
    code: 'US',
    label: 'United States',
    currency: 'USD',
    channels: ['mobile_app', 'web', 'api', 'pos'],
    paymentRails: ['ach', 'card', 'bank_transfer', 'wallet_transfer', 'payout'],
    accountTypes: ['checking', 'wallet', 'credit'],
    beneficiaryTypes: ['bank_account', 'wallet', 'card'],
    merchantCategories: ['ecommerce', 'gaming', 'groceries', 'travel', 'digital_goods', 'lending'],
    identityTypes: ['ssn_like_id', 'drivers_license', 'passport'],
    kycProviders: ['synthetic_ssn_check', 'synthetic_document_check'],
    bankCodeLength: 9
  },
  GB: {
    code: 'GB',
    label: 'United Kingdom',
    currency: 'GBP',
    channels: ['mobile_app', 'web', 'api', 'pos'],
    paymentRails: ['bank_transfer', 'card', 'swift', 'payout'],
    accountTypes: ['current', 'wallet', 'credit'],
    beneficiaryTypes: ['bank_account', 'wallet', 'card'],
    merchantCategories: ['ecommerce', 'gaming', 'groceries', 'travel', 'digital_goods'],
    identityTypes: ['national_id', 'drivers_license', 'passport', 'tax_id'],
    kycProviders: ['synthetic_document_check', 'synthetic_address_check'],
    bankCodeLength: 6
  },
  EU: {
    code: 'EU',
    label: 'European Union',
    currency: 'EUR',
    channels: ['mobile_app', 'web', 'api', 'pos'],
    paymentRails: ['sepa', 'card', 'swift', 'bank_transfer', 'payout'],
    accountTypes: ['current', 'wallet', 'credit'],
    beneficiaryTypes: ['bank_account', 'wallet', 'card'],
    merchantCategories: ['ecommerce', 'gaming', 'groceries', 'travel', 'digital_goods'],
    identityTypes: ['national_id', 'passport', 'tax_id'],
    kycProviders: ['synthetic_eidas_check', 'synthetic_document_check'],
    bankCodeLength: 8
  },
  KE: {
    code: 'KE',
    label: 'Kenya',
    currency: 'KES',
    channels: ['mobile_app', 'web', 'api', 'ussd', 'pos'],
    paymentRails: ['mobile_money', 'wallet_transfer', 'bank_transfer', 'cashout', 'merchant_payment'],
    accountTypes: ['mobile_money', 'wallet', 'savings'],
    beneficiaryTypes: ['mobile_money', 'bank_account', 'wallet'],
    merchantCategories: ['airtime', 'bill_payments', 'ecommerce', 'groceries', 'remittance'],
    identityTypes: ['national_id', 'mobile_money_id', 'passport'],
    kycProviders: ['synthetic_national_id_check', 'synthetic_mobile_money_check'],
    bankCodeLength: 5
  },
  GH: {
    code: 'GH',
    label: 'Ghana',
    currency: 'GHS',
    channels: ['mobile_app', 'web', 'api', 'ussd', 'pos'],
    paymentRails: ['mobile_money', 'wallet_transfer', 'bank_transfer', 'cashout', 'merchant_payment'],
    accountTypes: ['mobile_money', 'wallet', 'savings'],
    beneficiaryTypes: ['mobile_money', 'bank_account', 'wallet'],
    merchantCategories: ['airtime', 'bill_payments', 'ecommerce', 'groceries', 'remittance'],
    identityTypes: ['national_id', 'mobile_money_id', 'passport'],
    kycProviders: ['synthetic_ghana_card_check', 'synthetic_mobile_money_check'],
    bankCodeLength: 3
  },
  ZA: {
    code: 'ZA',
    label: 'South Africa',
    currency: 'ZAR',
    channels: ['mobile_app', 'web', 'api', 'pos'],
    paymentRails: ['bank_transfer', 'card', 'swift', 'wallet_transfer', 'payout'],
    accountTypes: ['current', 'savings', 'wallet', 'credit'],
    beneficiaryTypes: ['bank_account', 'wallet', 'card'],
    merchantCategories: ['bill_payments', 'ecommerce', 'gaming', 'groceries', 'travel'],
    identityTypes: ['national_id', 'passport', 'tax_id'],
    kycProviders: ['synthetic_national_id_check', 'synthetic_document_check'],
    bankCodeLength: 6
  }
};

const registeredProfiles = new Map<string, CountryProfile>();

export function registerCountryProfile(profile: CountryProfile): void {
  registeredProfiles.set(normalizeCountry(profile.code), {
    ...profile,
    code: normalizeCountry(profile.code),
    currency: profile.currency.toUpperCase()
  });
}

export function registerCountryProfilesFromPlugin(plugin: GenerationPlugin): void {
  for (const profile of plugin.countryProfiles ?? []) {
    registerCountryProfile(profile);
  }
}

export function getCountryProfile(country: string, profileCode?: string): CountryProfile {
  const code = normalizeCountry(profileCode ?? country);
  const profile = registeredProfiles.get(code) ?? builtInProfiles[code];
  if (profile) return profile;
  return {
    ...builtInProfiles.NG,
    code: normalizeCountry(country),
    label: `${normalizeCountry(country)} generic profile`,
    currency: 'USD'
  };
}

export function listCountryProfiles(): CountryProfile[] {
  return [...Object.values(builtInProfiles), ...registeredProfiles.values()];
}
