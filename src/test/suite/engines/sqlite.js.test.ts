import * as assert from 'assert';
import { SqliteJsEngine } from '../../../database-engines/sqlite.js-engine';

describe('Sqlite.js Tests', () => {
	it('sqlite.js: should return correct foreign key definitions', async () => {
		let sqliteJs: SqliteJsEngine = new SqliteJsEngine()
		await sqliteJs.boot();

		// Create two tables with a foreign key relationship for testing
		sqliteJs.getDatabase().exec(`
        CREATE TABLE ParentTable (
            id INTEGER PRIMARY KEY AUTOINCREMENT
        )
    `);

		sqliteJs.getDatabase().exec(`
        CREATE TABLE ChildTable (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parentId INTEGER,
            FOREIGN KEY(parentId) REFERENCES ParentTable(id)
        )
    `);

		const columns = await sqliteJs.getColumns('ChildTable');

		const foreignKeyColumn = columns.find(column => column.name === 'parentId');

		assert.strictEqual(foreignKeyColumn?.foreignKey?.table, 'ParentTable');
	});

	describe('SqliteJsEngine Tests', () => {
		let sqliteJs: SqliteJsEngine;

		beforeEach(async () => {
			sqliteJs = new SqliteJsEngine()
			await sqliteJs.boot();
			const ok = await sqliteJs.isOkay();
			assert.strictEqual(ok, true);
		});

		afterEach(async () => {
			const tables = await sqliteJs.getTables();
			for (const table of tables) {
				sqliteJs.getDatabase().exec(`DROP TABLE ${table}`);
			}
			await sqliteJs.disconnect();
		});

		it('should return correct table names', async () => {
			sqliteJs.getDatabase().exec(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                name TEXT,
                age INTEGER
            )
        `);

			sqliteJs.getDatabase().exec(`
            CREATE TABLE products (
                id INTEGER PRIMARY KEY,
                name TEXT,
                price INTEGER
            )
        `);

			const tables = await sqliteJs.getTables();
			assert.deepStrictEqual(tables, ['products', 'users']);
		});

		it('should return correct column definitions', async () => {
			sqliteJs.getDatabase().exec(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY NOT NULL,
                name TEXT,
                age INTEGER
            )
        `);

			const columns = await sqliteJs.getColumns('users');
			assert.deepStrictEqual(columns, [
				{ name: 'id', type: 'INTEGER', isPrimaryKey: true, isOptional: false, foreignKey: undefined },
				{ name: 'name', type: 'TEXT', isPrimaryKey: false, isOptional: true, foreignKey: undefined },
				{ name: 'age', type: 'INTEGER', isPrimaryKey: false, isOptional: true, foreignKey: undefined }
			]);
		});

		it('should return correct total rows', async () => {
			sqliteJs.getDatabase().exec(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                name TEXT,
                age INTEGER
            )
        `);

			sqliteJs.getDatabase().exec(`
            INSERT INTO users (name, age) VALUES
            ('John', 30),
            ('Jane', 25),
            ('Bob', 40)
        `);

			const totalRows = await sqliteJs.getTotalRows('users');
			assert.strictEqual(totalRows, 3);
		});

		it('should return correct rows', async () => {
			sqliteJs.getDatabase().exec(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                name TEXT,
                age INTEGER
            )
        `);

			sqliteJs.getDatabase().exec(`
            INSERT INTO users (name, age) VALUES
            ('John', 30),
            ('Jane', 25),
            ('Bob', 40)
        `);

			const rows = await sqliteJs.getRows('users', 2, 0);
			assert.deepStrictEqual(rows?.rows, [
				{ id: 1, name: 'John', age: 30 },
				{ id: 2, name: 'Jane', age: 25 }
			]);
		});

		it('should return correct table creation SQL', async () => {
			sqliteJs.getDatabase().exec(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                name TEXT,
                age INTEGER
            )
        `);

			const creationSql = (await sqliteJs.getTableCreationSql('users'))
				// make single line by removing newlines and tabs, and turn all spaces into single spaces
				.replace(/\n|\t/g, '')
				.replace(/\s+/g, ' ')
				.trim();

			assert.strictEqual(creationSql, 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)');
		});
	});
});