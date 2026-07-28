import mysql from 'mysql2/promise'
import 'dotenv/config'

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'testwallbooker',
  waitForConnections: true,
  connectionLimit: 10,
})

export async function initDb() {
  // Accounts table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      profile_picture LONGBLOB,
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      location VARCHAR(255),
      timezone VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  // Access rights/roles table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS access_rights (
      id INT AUTO_INCREMENT PRIMARY KEY,
      role_name VARCHAR(100) NOT NULL UNIQUE,
      description VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // User-access rights joining table (many-to-many)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS user_access_rights (
      user_id INT NOT NULL,
      access_right_id INT NOT NULL,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, access_right_id),
      FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (access_right_id) REFERENCES access_rights(id) ON DELETE CASCADE
    )
  `)

  // Testwalls table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS testwalls (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  // Bookings table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      testwall_id INT NOT NULL,
      user_id INT NOT NULL,
      from_time DATETIME NOT NULL,
      to_time DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (testwall_id) REFERENCES testwalls(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE,
      INDEX idx_testwall (testwall_id),
      INDEX idx_user (user_id),
      INDEX idx_times (from_time, to_time)
    )
  `)

  // Logs table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      action VARCHAR(500) NOT NULL,
      details TEXT,
      ip_address VARCHAR(45),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE SET NULL,
      INDEX idx_user (user_id),
      INDEX idx_created (created_at)
    )
  `)

  // Command history table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS command_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      command TEXT NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE,
      INDEX idx_user (user_id),
      INDEX idx_executed (executed_at)
    )
  `)

  // Insert default access rights
  await pool.execute(`
    INSERT IGNORE INTO access_rights (role_name, description)
    VALUES 
      ('admin', 'Administrator with full access'),
      ('user', 'Regular user with limited access'),
      ('operator', 'Can book and use testwalls')
  `)
}
