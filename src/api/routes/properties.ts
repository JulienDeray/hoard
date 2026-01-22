/**
 * Property Routes
 *
 * POST /api/properties - Create a property with optional mortgage
 * GET /api/properties - List all properties with equity
 * GET /api/properties/:id - Get property details
 * PUT /api/properties/:id - Update property metadata
 * PUT /api/properties/:id/value - Update property valuation
 */

import type { FastifyInstance } from 'fastify';
import type { PropertyType } from '../../models/property.js';

// Query/Param types
interface IdParams {
  id: string;
}

// Request body types
interface CreatePropertyBody {
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
  mortgage?: {
    name: string;
    originalAmount: number;
    outstandingAmount: number;
    interestRate?: number;
    startDate?: string;
    termMonths?: number;
  };
}

interface UpdatePropertyBody {
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

interface UpdatePropertyValueBody {
  value: number;
  valuationDate?: string;
}

// Response helper
function formatPropertyResponse(property: any) {
  return {
    id: property.id,
    symbol: property.symbol,
    name: property.name,
    propertyType: property.metadata.propertyType,
    address: property.metadata.address,
    city: property.metadata.city,
    country: property.metadata.country,
    purchaseDate: property.metadata.purchaseDate,
    purchasePrice: property.metadata.purchasePrice,
    squareMeters: property.metadata.squareMeters,
    rooms: property.metadata.rooms,
    rentalIncome: property.metadata.rentalIncome,
    currentValue: property.currentValue,
    mortgageBalance: property.mortgageBalance,
    mortgageId: property.mortgageId,
    equity: property.equity,
    ltvPercentage: property.ltvPercentage,
    currency: property.currency,
  };
}

export async function propertyRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/properties - Create a property with optional mortgage
   */
  fastify.post<{ Body: CreatePropertyBody }>(
    '/',
    async (request, reply) => {
      const {
        name,
        propertyType,
        currentValue,
        address,
        city,
        country,
        purchaseDate,
        purchasePrice,
        squareMeters,
        rooms,
        rentalIncome,
        currency,
        mortgage,
      } = request.body;

      const property = fastify.services.propertyService.create({
        name,
        propertyType,
        currentValue,
        address,
        city,
        country,
        purchaseDate,
        purchasePrice,
        squareMeters,
        rooms,
        rentalIncome,
        currency,
        mortgage: mortgage
          ? {
              name: mortgage.name,
              originalAmount: mortgage.originalAmount,
              outstandingAmount: mortgage.outstandingAmount,
              interestRate: mortgage.interestRate,
              startDate: mortgage.startDate,
              termMonths: mortgage.termMonths,
            }
          : undefined,
      });

      reply.status(201);
      return {
        data: formatPropertyResponse(property),
      };
    }
  );

  /**
   * GET /api/properties - List all properties with equity
   */
  fastify.get(
    '/',
    async () => {
      const properties = fastify.services.propertyService.list();

      return {
        data: properties.map(formatPropertyResponse),
        count: properties.length,
      };
    }
  );

  /**
   * GET /api/properties/:id - Get property details
   */
  fastify.get<{ Params: IdParams }>(
    '/:id',
    async (request) => {
      const { id } = request.params;
      const property = fastify.services.propertyService.getById(parseInt(id, 10));

      return {
        data: formatPropertyResponse(property),
      };
    }
  );

  /**
   * PUT /api/properties/:id - Update property metadata
   */
  fastify.put<{ Params: IdParams; Body: UpdatePropertyBody }>(
    '/:id',
    async (request) => {
      const { id } = request.params;
      const {
        name,
        propertyType,
        address,
        city,
        country,
        purchaseDate,
        purchasePrice,
        squareMeters,
        rooms,
        rentalIncome,
      } = request.body;

      const property = fastify.services.propertyService.update(parseInt(id, 10), {
        name,
        propertyType,
        address,
        city,
        country,
        purchaseDate,
        purchasePrice,
        squareMeters,
        rooms,
        rentalIncome,
      });

      return {
        data: formatPropertyResponse(property),
      };
    }
  );

  /**
   * PUT /api/properties/:id/value - Update property valuation
   */
  fastify.put<{ Params: IdParams; Body: UpdatePropertyValueBody }>(
    '/:id/value',
    async (request) => {
      const { id } = request.params;
      const { value, valuationDate } = request.body;

      const property = fastify.services.propertyService.updateValue(parseInt(id, 10), {
        value,
        valuationDate,
      });

      return {
        data: formatPropertyResponse(property),
        message: 'Property valuation updated. Snapshot caches have been invalidated.',
      };
    }
  );
}
