import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { RepositoryName } from '../../../src/database/repository-name.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('RepositoryName', () => {
  let db: Database.Database;
  let repository: RepositoryName;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:');

    // Run migrations
    const migrationPath = join(__dirname, '../../../src/database/migrations/schema-name/001_initial.sql');
    const migration = readFileSync(migrationPath, 'utf-8');
    db.exec(migration);

    // Initialize repository
    repository = new RepositoryName(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('should create a new record', () => {
      // Arrange
      const data = { /* test data */ };

      // Act
      const result = repository.create(data);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBeTypeOf('number');
      expect(result.field).toBe(data.field);
    });

    it('should throw on duplicate constraint violation', () => {
      // Arrange
      const data = { /* test data with unique field */ };
      repository.create(data);

      // Act & Assert
      expect(() => repository.create(data)).toThrow();
    });
  });

  describe('get', () => {
    it('should retrieve existing record', () => {
      // Arrange
      const created = repository.create({ /* data */ });

      // Act
      const result = repository.get(created.id);

      // Assert
      expect(result).toEqual(created);
    });

    it('should return undefined for non-existent record', () => {
      // Act
      const result = repository.get(99999);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should return all records', () => {
      // Arrange
      repository.create({ /* data 1 */ });
      repository.create({ /* data 2 */ });

      // Act
      const results = repository.list();

      // Assert
      expect(results).toHaveLength(2);
    });

    it('should return empty array when no records', () => {
      // Act
      const results = repository.list();

      // Assert
      expect(results).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update existing record', () => {
      // Arrange
      const created = repository.create({ /* data */ });
      const updates = { /* updated fields */ };

      // Act
      repository.update(created.id, updates);
      const result = repository.get(created.id);

      // Assert
      expect(result.field).toBe(updates.field);
    });
  });

  describe('delete', () => {
    it('should delete existing record', () => {
      // Arrange
      const created = repository.create({ /* data */ });

      // Act
      repository.delete(created.id);
      const result = repository.get(created.id);

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
