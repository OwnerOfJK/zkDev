import mariadb from 'mariadb';

export class DB {
  //private static _instance: DB;

  pool: mariadb.Pool;

  constructor() {
    console.log('DB init');
    this.pool = mariadb.createPool({
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PW,
      connectionLimit: 5
    });
    this.dbConnect();
  }

  public static get instance() {
    return this._instance || (this._instance = new this());
  }

  static async executeQuery(query: string) {
    try {
      return await this.instance.pool.query(query);
    } catch(error) { throw error }
  }

  private dbConnect() {
    try {
      this.pool.getConnection();
      console.log('DB connected');
    } catch(error) {
      console.error(error);
      return;
    }
  }
  public queryDB(query: string) {
	  this.executeQuery(query)
		.then(data => res.json({
		  ok: true,
		  data
		}))
		.catch(error => res.status(400).json({
		  ok: false,
		  error
		}));
  }
}

