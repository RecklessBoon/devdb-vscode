import { Dialect, QueryTypes, Sequelize } from "sequelize";
import { QueryResponse, QueryRunner } from "../types";
import { reportError } from "./initialization-error-service";

export const SqlService = {

	buildWhereClause(whereClause?: Record<string, any>): { where: string[], replacements: string[] } {
		if (!whereClause) return {
			where: [],
			replacements: []
		}

		const where: string[] = [];
		const replacements: string[] = [];

		Object.entries(whereClause)
			.forEach(([column, value]) => {
				where.push(`${column} LIKE ?`)
				replacements.push(`%${value}%`);
			})

		return { where, replacements }
	},

	async getRows(dialect: Dialect, runner: QueryRunner | Sequelize | null, table: string, limit: number, offset: number, whereClause?: Record<string, any>): Promise<QueryResponse | undefined> {
		if (!runner) return;

		let delimiter = '`'
		if (dialect === 'postgres') {
			delimiter = '"';
		}

		const { where, replacements } = this.buildWhereClause(whereClause);

		let limitConstraint = limit ? `LIMIT ${limit}` : '';
		limitConstraint += offset ? ` OFFSET ${offset}` : '';

		const whereString = where.length ? `WHERE ${where.join(' AND ')}` : '';
		let sql;
		let rows

		try {
			rows = await runner.query(
				`SELECT * FROM ${delimiter}${table}${delimiter} ${whereString} ${limitConstraint}`, {
				type: QueryTypes.SELECT,
				raw: true,
				replacements,
				logging: (query: any) => { sql = query }
			});
		} catch (error) {
			reportError(String(error));
			return
		}

		return { rows, sql };
	},

	async getTotalRows(dialect: Dialect, runner: QueryRunner | Sequelize | null, table: string, whereClause?: Record<string, any>): Promise<number | undefined> {
		if (!runner) return;

		let delimiter = '`'
		if (dialect === 'postgres') {
			delimiter = '"';
		}

		const { where, replacements } = this.buildWhereClause(whereClause);
		const whereString = where.length ? `WHERE ${where.join(' AND ')}` : '';
		let count;

		try {
			count = await runner.query(`SELECT COUNT(*) FROM ${delimiter}${table}${delimiter} ${whereString}`, {
				type: QueryTypes.SELECT,
				raw: true,
				replacements,
				logging: false
			});
		} catch (error) {
			reportError(String(error))
			return
		}

		let totalRows = (count[0] as { 'COUNT(*)': string })['COUNT(*)'];

		if (dialect === 'postgres') {
			totalRows = (count[0] as { count: string })['count'];
		}

		return totalRows
			? Number(totalRows)
			: 0
	},
}