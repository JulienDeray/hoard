import type { LiabilityType } from './liability.js';

export type PropertyType = 'PRIMARY_RESIDENCE' | 'RENTAL' | 'VACATION' | 'COMMERCIAL' | 'LAND' | 'OTHER';

/**
 * Metadata stored in JSON format in the assets.metadata column
 */
export interface PropertyMetadata {
  propertyType: PropertyType;
  address?: string;
  city?: string;
  country?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  squareMeters?: number;
  rooms?: number;
  rentalIncome?: number;
}

/**
 * Property with linked mortgage and equity calculation
 */
export interface PropertyWithEquity {
  id: number;
  symbol: string;
  name: string;
  metadata: PropertyMetadata;
  currentValue: number;
  mortgageBalance: number | null;
  mortgageId: number | null;
  equity: number;
  ltvPercentage: number | null;
  currency: string;
}

/**
 * Input for creating a new property
 */
export interface CreatePropertyInput {
  name: string;
  propertyType: PropertyType;
  currentValue: number;
  address?: string;
  city?: string;
  country?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  squareMeters?: number;
  rooms?: number;
  rentalIncome?: number;
  currency?: string;
  /** If provided, creates a linked mortgage */
  mortgage?: CreatePropertyMortgageInput;
}

/**
 * Input for creating a mortgage linked to a property
 */
export interface CreatePropertyMortgageInput {
  name: string;
  originalAmount: number;
  outstandingAmount: number;
  interestRate?: number;
  startDate?: string;
  termMonths?: number;
}

/**
 * Input for updating property metadata
 */
export interface UpdatePropertyInput {
  name?: string;
  propertyType?: PropertyType;
  address?: string;
  city?: string;
  country?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  squareMeters?: number;
  rooms?: number;
  rentalIncome?: number;
}

/**
 * Input for updating property valuation
 */
export interface UpdatePropertyValueInput {
  value: number;
  valuationDate?: string;
}

/**
 * Aggregated summary for all real estate properties
 */
export interface RealEstateSummary {
  totalPropertyValue: number;
  totalMortgageBalance: number;
  totalEquity: number;
  propertyCount: number;
  properties: PropertyWithEquity[];
}

/**
 * Property with mortgage details for display
 */
export interface PropertyWithMortgage extends PropertyWithEquity {
  mortgageName?: string;
  mortgageType?: LiabilityType;
  mortgageOriginalAmount?: number;
  mortgageInterestRate?: number;
}
