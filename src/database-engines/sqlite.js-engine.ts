import { format } from 'sql-formatter';
import { Column, DatabaseEngine, ForeignKey, QueryResponse, QueryRunner } from '../types';
import { readFileSync } from 'fs';
import { SqlService } from '../services/sql';
import QueryTypes from 'sequelize/types/query-types';
import { Database } from 'sql.js';

export class SqliteJsEngine implements DatabaseEngine {
	private db: Database | null = null;
	private sqliteFilePath: string | undefined;

	constructor(sqliteFilePath?: string) {
		this.sqliteFilePath = sqliteFilePath;
	}

	public async boot(): Promise<void> {
		await this.init(this.sqliteFilePath);
	}

	public getDatabase(): Database {
		if (!this.db) throw new Error('Database not initialized')

		return this.db
	}

	private async init(sqliteFilePath?: string) {
		const initSqlJs = require('sql-wasm.js');
		const jsDb = await initSqlJs()

		if (sqliteFilePath) {
			const fileBuffer = readFileSync(sqliteFilePath);
			this.db = new jsDb.Database(fileBuffer);
		} else {
			this.db = new jsDb.Database();
		}
	}

	public async isOkay(): Promise<boolean> {
		if (!this.db) return false;

		const result = this.db.exec('PRAGMA integrity_check;');
		return result[0]?.values[0][0] === 'ok';
	}

	public async disconnect() {
		if (this.db)
			this.db.close();
	}

	public async getTableCreationSql(table: string): Promise<string> {
		if (!this.db) return '';

		const creationSql = this.db.exec(`SELECT sql FROM sqlite_master WHERE name = '${table}'`);
		const sql: initSqlJs.SqlValue = creationSql[0]?.values[0][0] as string
		return format(sql, { language: 'sql' });
	}

	public async getTables(): Promise<string[]> {
		if (!this.db) return [];

		const tables = this.db.exec("SELECT name FROM sqlite_master WHERE type='table'");
		return tables[0]?.values.map((table: any) => table[0]).sort();
	}

	public async getColumns(table: string): Promise<Column[]> {
		if (!this.db) return [];

		const columns = this.db.exec(`PRAGMA table_info(${table})`)[0]?.values;
		const computedColumns = [];

		for (const column of columns) {
			const foreignKey = await this.getForeignKeyFor(table, column[1] as string);

			computedColumns.push({
				name: column[1] as string,
				type: column[2] as string,
				isPrimaryKey: column[5] === 1,
				isOptional: column[3] === 0,
				foreignKey
			});
		}

		return computedColumns;
	}

	async getTotalRows(table: string, whereClause?: Record<string, any>): Promise<number | undefined> {
		return SqlService.getTotalRows('sqlite', this.getRunner(), table, whereClause);
	}

	async getRows(table: string, limit: number, offset: number, whereClause?: Record<string, any>): Promise<QueryResponse | undefined> {
		return SqlService.getRows('sqlite', this.getRunner(), table, limit, offset, whereClause);
	}

	private async getForeignKeyFor(table: string, column: string): Promise<ForeignKey | undefined> {
		if (!this.db) return;

		const foreignKeys = this.db.exec(`PRAGMA foreign_key_list(${table})`)[0]?.values;
		const foreignKey = foreignKeys?.find((fk: any) => fk[3] === column);

		if (!foreignKey) return;

		return {
			table: foreignKey[2] as string,
			column: foreignKey[3] as string
		};
	}

	private getRunner(): QueryRunner | null {
		if (!this.db) return null;

		return {
			query: (sql: string, config: {
				type: QueryTypes.SELECT | null,
				raw: boolean,
				replacements: string[],
				logging?: any
			}) => {
				const result: initSqlJs.QueryExecResult[] | undefined = this.db?.exec(sql);

				const mappedResult: Record<string, any>[] = this.getMapped(result)

				return Promise.resolve(mappedResult)
			}
		}
	}

	/**
	 * initSqlJs.QueryExecResult has the structure { columns: string[]; values: SqlValue[][];}
	 * We ned to map it such that it returns an array of object of rows: Record<string, any>[],
	 * whereas Record<string, any> is a map of column name to value for that row using the column name as the key.
	 * The columns to be used as keys in the Record<string, any> should be the column names from the columns property of the result.
	 */
	getMapped(result: initSqlJs.QueryExecResult[] | undefined): Record<string, any>[] {
		if (!result) return []

		const mappedResult = result[0].values.map((row: any) => {
			const mappedRow: Record<string, any> = {}
			for (let i = 0; i < result[0].columns.length; i++) {
				mappedRow[result[0].columns[i]] = row[i]
			}
			return mappedRow
		})

		return mappedResult
	}

}