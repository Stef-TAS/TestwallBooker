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
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (testwall_id) REFERENCES testwalls(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE,
      INDEX idx_testwall (testwall_id),
      INDEX idx_user (user_id),
      INDEX idx_times (from_time, to_time)
    )
  `)

  // Backward-compatible migration for databases created before the status column existed.
  const [bookingStatusColumn] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'bookings'
     AND COLUMN_NAME = 'status'`,
  )

  if ((bookingStatusColumn as any[])[0].count === 0) {
    await pool.execute(`
      ALTER TABLE bookings
      ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active'
    `)
  }

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

  // ================================================================
  // test_wall hardware database tables
  // The test_wall.locations table is merged into testwalls above.
  // Run server/migrations/import-test-wall-data.sql to populate data.
  // ================================================================

  // Add new columns to testwalls (from test_wall.locations)
  for (const [col, def] of [
    ['port', "VARCHAR(6) NOT NULL DEFAULT '8080'"],
    ['external_id', "VARCHAR(40) NOT NULL DEFAULT ''"],
    ['capability', 'TEXT NULL'],
    ['jenkins_name', "VARCHAR(100) NOT NULL DEFAULT ''"],
    ['is_tiny', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ] as [string, string][]) {
    const [colExists] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'testwalls' AND COLUMN_NAME = ?`,
      [col],
    )
    if ((colExists as any[])[0].cnt === 0) {
      await pool.execute(`ALTER TABLE testwalls ADD COLUMN ${col} ${def}`)
    }
  }

  await pool.execute(`CREATE TABLE IF NOT EXISTS relay_types (
    rt_id INT AUTO_INCREMENT PRIMARY KEY,
    rt_name VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS serial_type (
    st_id INT AUTO_INCREMENT PRIMARY KEY,
    st_name VARCHAR(50) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS shunt_type (
    st_id INT AUTO_INCREMENT PRIMARY KEY,
    st_name VARCHAR(40) NOT NULL,
    st_value FLOAT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS api_version (
    required_version VARCHAR(10) NOT NULL,
    latest_version VARCHAR(10) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS team_vm (
    id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    hostname VARCHAR(42) NOT NULL,
    ip_address VARCHAR(16) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS usb_device (
    id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    address VARCHAR(20) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS myduttype (
    mdt_id INT UNSIGNED PRIMARY KEY,
    mdt_name VARCHAR(250) NOT NULL,
    mdt_icon MEDIUMBLOB NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS supply_lanes (
    slane_id INT AUTO_INCREMENT PRIMARY KEY,
    slane_name VARCHAR(10) NOT NULL,
    sl_max_vol FLOAT NOT NULL,
    sl_max_cur FLOAT NOT NULL,
    sl_max_pow INT NOT NULL DEFAULT 320,
    l_id INT NOT NULL,
    KEY fk_supply_lid_1 (l_id),
    CONSTRAINT fk_supply_lid_1 FOREIGN KEY (l_id) REFERENCES testwalls(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS super_ios (
    sio_id INT AUTO_INCREMENT PRIMARY KEY,
    sio_manufacturer VARCHAR(40) NOT NULL,
    sio_model VARCHAR(40) NOT NULL,
    sio_pcan_port VARCHAR(40) NOT NULL,
    sio_baudrate VARCHAR(40) NOT NULL,
    sio_node_id INT NOT NULL,
    l_id INT NOT NULL,
    KEY fk_superio_lid (l_id),
    CONSTRAINT fk_superio_lid FOREIGN KEY (l_id) REFERENCES testwalls(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS modular_chassis (
    mc_id INT PRIMARY KEY,
    mc_manufacturer VARCHAR(40) NOT NULL,
    mc_model VARCHAR(40) NOT NULL,
    mc_ip_address VARCHAR(20) NOT NULL,
    mc_no INT NOT NULL,
    mc_port INT NOT NULL,
    mc_active TINYINT(4) NOT NULL,
    l_id INT NOT NULL,
    KEY fk_mc_lid (l_id),
    CONSTRAINT fk_mc_lid FOREIGN KEY (l_id) REFERENCES testwalls(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS duts (
    dut_id INT AUTO_INCREMENT PRIMARY KEY,
    dut_name VARCHAR(40) NOT NULL,
    dut_report_name VARCHAR(50) NOT NULL,
    dut_max_vol FLOAT NOT NULL,
    dut_obj_name VARCHAR(40) NOT NULL,
    dut_default_baudrate INT NOT NULL DEFAULT 500,
    dut_mac_addr CHAR(17) NOT NULL,
    l_id INT NOT NULL,
    KEY l_id (l_id),
    CONSTRAINT fk_dut_lid_1 FOREIGN KEY (l_id) REFERENCES testwalls(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS dut_pins (
    dutp_id INT AUTO_INCREMENT PRIMARY KEY,
    dutp_name VARCHAR(40) NOT NULL,
    dut_id INT NOT NULL,
    dutp_number VARCHAR(40) NOT NULL,
    KEY dut_id (dut_id),
    CONSTRAINT fk_dutp_dut_1 FOREIGN KEY (dut_id) REFERENCES duts(dut_id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS switching_matrices (
    sm_id INT AUTO_INCREMENT PRIMARY KEY,
    mc_id INT NOT NULL,
    sm_manufacturer VARCHAR(40) NOT NULL,
    sm_model VARCHAR(40) NOT NULL,
    sm_bus INT NOT NULL,
    sm_slot INT NOT NULL,
    sm_subunit INT NOT NULL,
    KEY fk_sm_mcid (mc_id),
    CONSTRAINT fk_sm_mcid FOREIGN KEY (mc_id) REFERENCES modular_chassis(mc_id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS can_lanes (
    cl_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cl_name VARCHAR(20) NOT NULL,
    cl_pcan_port VARCHAR(20) NOT NULL,
    sm_id INT NOT NULL,
    cl_y_coord INT NOT NULL,
    KEY c_matrixcoord (sm_id),
    CONSTRAINT c_matrixcoord FOREIGN KEY (sm_id) REFERENCES switching_matrices(sm_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS dut_cans (
    dcan_id INT AUTO_INCREMENT PRIMARY KEY,
    dcan_name VARCHAR(20) NOT NULL,
    dut_id INT NOT NULL,
    sm_id INT DEFAULT NULL,
    dcan_x_coord INT DEFAULT NULL,
    KEY fk_dcan_dut (dut_id),
    KEY fk_dcan_sm (sm_id),
    CONSTRAINT fk_dcan_dut FOREIGN KEY (dut_id) REFERENCES duts(dut_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_dcan_sm FOREIGN KEY (sm_id) REFERENCES switching_matrices(sm_id) ON DELETE NO ACTION ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS dut_matrix_pins (
    dmp_id INT AUTO_INCREMENT PRIMARY KEY,
    sm_id INT NOT NULL,
    dutp_id INT NOT NULL,
    dmp_x_coord INT DEFAULT NULL,
    enforce_short_limit TINYINT(4) NOT NULL,
    KEY sm_id (sm_id),
    KEY dutp_id (dutp_id),
    CONSTRAINT fk_dmp_dutp FOREIGN KEY (dutp_id) REFERENCES dut_pins(dutp_id) ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS dut_matrix_resistors (
    r_id INT AUTO_INCREMENT PRIMARY KEY,
    dutp_id INT NOT NULL,
    sm_id INT NOT NULL,
    dmr_x_coord INT NOT NULL,
    dut_id INT NOT NULL,
    KEY fk_dmr_sm_id (sm_id),
    KEY fk_dmr_dut_id (dut_id),
    KEY fk_dmr_dutp_id (dutp_id),
    CONSTRAINT fk_dmr_dut_id FOREIGN KEY (dut_id) REFERENCES duts(dut_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_dmr_dutp_id FOREIGN KEY (dutp_id) REFERENCES dut_pins(dutp_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT fk_dmr_sm_id FOREIGN KEY (sm_id) REFERENCES switching_matrices(sm_id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS daqs (
    daq_id INT AUTO_INCREMENT PRIMARY KEY,
    daq_manufacturer VARCHAR(40) NOT NULL,
    daq_model VARCHAR(40) NOT NULL,
    daq_connection_type VARCHAR(3) NOT NULL,
    daq_resource_string VARCHAR(200) DEFAULT NULL,
    daq_ip_address VARCHAR(20) DEFAULT NULL,
    daq_port INT DEFAULT NULL,
    l_id INT NOT NULL,
    KEY fk_daqs_lid (l_id),
    CONSTRAINT fk_daqs_lid FOREIGN KEY (l_id) REFERENCES testwalls(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS daq_channels (
    daqc_id INT AUTO_INCREMENT PRIMARY KEY,
    daqc_name VARCHAR(40) NOT NULL,
    daqc_number INT NOT NULL,
    daq_id INT NOT NULL,
    daqc_dutp_id INT DEFAULT NULL,
    daqc_ch_type VARCHAR(4) NOT NULL,
    KEY daq (daq_id),
    KEY daqc_dutp_id (daqc_dutp_id),
    CONSTRAINT fk_daqc_daq FOREIGN KEY (daq_id) REFERENCES daqs(daq_id),
    CONSTRAINT fk_daqc_dutp FOREIGN KEY (daqc_dutp_id) REFERENCES dut_pins(dutp_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS eth_switches (
    es_id INT AUTO_INCREMENT PRIMARY KEY,
    es_manufacturer VARCHAR(40) NOT NULL,
    es_model VARCHAR(40) NOT NULL,
    es_ip_address VARCHAR(20) NOT NULL,
    l_id INT NOT NULL,
    KEY fk_switches_lid (l_id),
    CONSTRAINT fk_switches_lid FOREIGN KEY (l_id) REFERENCES testwalls(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS eth_ports (
    ep_id INT AUTO_INCREMENT PRIMARY KEY,
    ep_port INT NOT NULL,
    ep_name VARCHAR(40) NOT NULL,
    dut_id INT NOT NULL,
    es_id INT NOT NULL,
    KEY dut_id (dut_id),
    KEY es_id (es_id),
    CONSTRAINT fk_ep_dut FOREIGN KEY (dut_id) REFERENCES duts(dut_id),
    CONSTRAINT fk_ep_es FOREIGN KEY (es_id) REFERENCES eth_switches(es_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS ewalds (
    ewld_id INT AUTO_INCREMENT PRIMARY KEY,
    ewld_name VARCHAR(40) NOT NULL,
    ewld_channel VARCHAR(20) NOT NULL,
    l_id INT NOT NULL,
    KEY fk_ewalds_lid_1 (l_id),
    CONSTRAINT fk_ewalds_lid_1 FOREIGN KEY (l_id) REFERENCES testwalls(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS ewald_waldies (
    wldie_id INT AUTO_INCREMENT PRIMARY KEY,
    wldie_name VARCHAR(40) NOT NULL,
    ewld_id INT NOT NULL,
    dutp_id INT NOT NULL,
    wldie_gpio_id INT NOT NULL,
    wldie_load FLOAT DEFAULT NULL,
    wldie_max_short_time INT NOT NULL DEFAULT 1500,
    KEY dut_pin (dutp_id),
    KEY ewld_id (ewld_id),
    CONSTRAINT fk_wldie_ewld FOREIGN KEY (ewld_id) REFERENCES ewalds(ewld_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS ewald_waldies_inactive (
    bck_wldie_id INT AUTO_INCREMENT PRIMARY KEY,
    bck_wldie_name VARCHAR(40) NOT NULL,
    bck_ewld_id INT NOT NULL,
    bck_dutp_id INT NOT NULL,
    bck_wldie_gpio_id INT NOT NULL,
    bck_wldie_max_short_time INT NOT NULL DEFAULT 255,
    KEY dut_pin (bck_dutp_id),
    KEY ewld_id (bck_ewld_id),
    CONSTRAINT fk_bck_dutp FOREIGN KEY (bck_dutp_id) REFERENCES dut_pins(dutp_id),
    CONSTRAINT fk_bck_ewld FOREIGN KEY (bck_ewld_id) REFERENCES ewalds(ewld_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS usb_relays (
    urel_id INT AUTO_INCREMENT PRIMARY KEY,
    urel_manufacturer VARCHAR(42) NOT NULL,
    urel_model VARCHAR(42) NOT NULL,
    urel_channels INT NOT NULL,
    urel_com VARCHAR(5) NOT NULL,
    l_id INT NOT NULL,
    urel_index INT NOT NULL,
    KEY location_od (l_id),
    KEY urel_index (urel_index),
    CONSTRAINT fk_urel_lid FOREIGN KEY (l_id) REFERENCES testwalls(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS usb_relay_pins (
    urp_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    urel_id INT NOT NULL,
    urp_pin INT NOT NULL,
    KEY fk_urp_urelid (urel_id),
    CONSTRAINT fk_urp_urelid FOREIGN KEY (urel_id) REFERENCES usb_relays(urel_id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS power_supplies (
    ps_id INT AUTO_INCREMENT PRIMARY KEY,
    ps_manufacturer VARCHAR(40) NOT NULL,
    ps_model VARCHAR(40) NOT NULL,
    ps_conn_type VARCHAR(3) NOT NULL DEFAULT 'ETH',
    ps_resource_string VARCHAR(200) DEFAULT NULL,
    ps_ip_address VARCHAR(20) DEFAULT NULL,
    ps_port INT DEFAULT NULL,
    slane_id INT NOT NULL,
    ps_driver VARCHAR(40) NOT NULL,
    l_id INT NOT NULL,
    KEY supplies (slane_id),
    KEY fk_ps_lid_1 (l_id),
    CONSTRAINT fk_ps_lid_1 FOREIGN KEY (l_id) REFERENCES testwalls(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ps_slane FOREIGN KEY (slane_id) REFERENCES supply_lanes(slane_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS relays (
    rel_id INT AUTO_INCREMENT PRIMARY KEY,
    rel_name VARCHAR(40) NOT NULL,
    dut_id INT NOT NULL,
    rt_id INT NOT NULL,
    rel_count INT UNSIGNED NOT NULL DEFAULT 0,
    slane_id INT DEFAULT NULL,
    KEY dut (dut_id),
    KEY relays_ibfk_2 (rt_id),
    KEY slane_id (slane_id),
    CONSTRAINT fk_relay_dut FOREIGN KEY (dut_id) REFERENCES duts(dut_id),
    CONSTRAINT fk_relay_rt FOREIGN KEY (rt_id) REFERENCES relay_types(rt_id),
    CONSTRAINT fk_relay_slane FOREIGN KEY (slane_id) REFERENCES supply_lanes(slane_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS super_io_pins (
    siop_id INT AUTO_INCREMENT PRIMARY KEY,
    sio_id INT NOT NULL,
    siop_name VARCHAR(40) NOT NULL,
    siop_node INT NOT NULL,
    siop_pin INT NOT NULL,
    siop_output TINYINT(1) NOT NULL,
    KEY sio_id (sio_id),
    CONSTRAINT fk_siop_sio FOREIGN KEY (sio_id) REFERENCES super_ios(sio_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS lights (
    l_id INT AUTO_INCREMENT PRIMARY KEY,
    l_color VARCHAR(20) NOT NULL,
    siop_id INT NOT NULL,
    KEY c_super_io_pin (siop_id),
    CONSTRAINT c_super_io_pin FOREIGN KEY (siop_id) REFERENCES super_io_pins(siop_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS relay_superio (
    rel_id INT NOT NULL,
    siop_id INT NOT NULL,
    KEY fk_rsiop_relid (rel_id),
    KEY fk_rsiop_siopid (siop_id),
    CONSTRAINT fk_rsiop_relid FOREIGN KEY (rel_id) REFERENCES relays(rel_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT fk_rsiop_siopid FOREIGN KEY (siop_id) REFERENCES super_io_pins(siop_id) ON DELETE NO ACTION ON UPDATE NO ACTION
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS relay_usb (
    rel_id INT NOT NULL,
    urp_id INT UNSIGNED NOT NULL,
    KEY fk_relayusb_urpid (urp_id),
    KEY fk_relayusb_relid (rel_id),
    CONSTRAINT fk_relayusb_relid FOREIGN KEY (rel_id) REFERENCES relays(rel_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT fk_relayusb_urpid FOREIGN KEY (urp_id) REFERENCES usb_relay_pins(urp_id) ON DELETE NO ACTION ON UPDATE NO ACTION
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS resistor_lanes (
    rl_id INT AUTO_INCREMENT PRIMARY KEY,
    rl_name VARCHAR(3) NOT NULL,
    sm_id_1 INT NOT NULL,
    rl_y_coord_1 INT NOT NULL,
    sm_id_2 INT NOT NULL,
    rl_y_coord_2 INT NOT NULL,
    KEY sm_coord_1 (sm_id_1),
    KEY sm_coord_2 (sm_id_2),
    CONSTRAINT fk_resistor_smid_1 FOREIGN KEY (sm_id_1) REFERENCES switching_matrices(sm_id) ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT fk_resistor_smid_2 FOREIGN KEY (sm_id_2) REFERENCES switching_matrices(sm_id) ON DELETE NO ACTION ON UPDATE NO ACTION
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS matrix_lanes (
    ml_id INT AUTO_INCREMENT PRIMARY KEY,
    sm_id INT NOT NULL,
    ml_name VARCHAR(100) NOT NULL,
    sm_subunit INT NOT NULL,
    sm_y_coord INT NOT NULL,
    ml_max_close_time INT DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS matrix_outputs (
    mo_id INT AUTO_INCREMENT PRIMARY KEY,
    dmp_id INT NOT NULL,
    mo_name VARCHAR(100) NOT NULL,
    sm_subunit INT NOT NULL,
    sm_output INT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS \`serial\` (
    s_id INT AUTO_INCREMENT PRIMARY KEY,
    s_comport TEXT NOT NULL,
    dut_id INT NOT NULL,
    st_id INT NOT NULL,
    KEY serial_ibfk_1 (dut_id),
    KEY serial_ibfk_2 (st_id),
    CONSTRAINT fk_serial_dut FOREIGN KEY (dut_id) REFERENCES duts(dut_id),
    CONSTRAINT fk_serial_st FOREIGN KEY (st_id) REFERENCES serial_type(st_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS shunt_resistors (
    sres_id INT AUTO_INCREMENT PRIMARY KEY,
    sres_name VARCHAR(30) NOT NULL,
    st_id INT NOT NULL,
    dut_id INT NOT NULL,
    slane_id INT DEFAULT NULL,
    daqc_id INT NOT NULL,
    KEY dut (dut_id),
    KEY supply_lane (slane_id),
    KEY st_id (st_id),
    KEY daq_channel (daqc_id),
    CONSTRAINT fk_sres_daqc FOREIGN KEY (daqc_id) REFERENCES daq_channels(daqc_id),
    CONSTRAINT fk_sres_dut FOREIGN KEY (dut_id) REFERENCES duts(dut_id),
    CONSTRAINT fk_sres_slane FOREIGN KEY (slane_id) REFERENCES supply_lanes(slane_id),
    CONSTRAINT fk_sres_sht FOREIGN KEY (st_id) REFERENCES shunt_type(st_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS attenuators (
    at_id INT AUTO_INCREMENT PRIMARY KEY,
    at_serial_number VARCHAR(30) NOT NULL,
    at_antenna VARCHAR(50) NOT NULL,
    at_dut_id INT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS dut_pcan_port (
    pp_id INT AUTO_INCREMENT PRIMARY KEY,
    dut_id INT NOT NULL,
    pcan_port VARCHAR(20) NOT NULL,
    KEY dut_id (dut_id),
    CONSTRAINT fk_pcan_dut FOREIGN KEY (dut_id) REFERENCES duts(dut_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS dut_vector_can (
    dvcan_id INT PRIMARY KEY,
    dcan_id INT NOT NULL,
    device_channel INT NOT NULL,
    bitrate INT NOT NULL,
    app_name VARCHAR(50) DEFAULT NULL,
    additional_config TEXT DEFAULT NULL,
    KEY dcan_id (dcan_id),
    CONSTRAINT fk_dvcan_dcan FOREIGN KEY (dcan_id) REFERENCES dut_cans(dcan_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS ethernet_relays (
    er_id INT UNSIGNED PRIMARY KEY,
    er_name VARCHAR(40) NOT NULL,
    ip_address VARCHAR(20) NOT NULL,
    port INT UNSIGNED NOT NULL,
    channel INT UNSIGNED NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS ethernet_relays_location (
    er_id INT UNSIGNED NOT NULL,
    l_id INT NOT NULL,
    PRIMARY KEY (er_id, l_id),
    KEY fk_erl_to_l (l_id),
    CONSTRAINT fk_erl_to_er FOREIGN KEY (er_id) REFERENCES ethernet_relays(er_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_erl_to_l FOREIGN KEY (l_id) REFERENCES testwalls(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS fallback_mode (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dut_id INT NOT NULL,
    dutp_nums VARCHAR(30) NOT NULL,
    default_values VARCHAR(300) NOT NULL DEFAULT '{ "baudrate": 500, "can": 0, "download_id": 1, "upload_id": 2, "node_number": 0, "ip_address": 0, "subnet_mask": 0, "multicast_address": 0 }',
    UNIQUE KEY dut_id (dut_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS variant_changer (
    v_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    v_name VARCHAR(40) NOT NULL,
    num_level INT UNSIGNED NOT NULL,
    l_id INT NOT NULL,
    COM_port INT UNSIGNED NOT NULL,
    KEY index_variantLocation (l_id),
    CONSTRAINT fk_variantToLocation FOREIGN KEY (l_id) REFERENCES testwalls(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS variants (
    v_id INT UNSIGNED NOT NULL,
    num_level INT UNSIGNED NOT NULL,
    dut_id INT NOT NULL,
    variant_name VARCHAR(40) NOT NULL,
    prod_code VARCHAR(40) NOT NULL,
    PRIMARY KEY (v_id, num_level, dut_id),
    KEY fk_variantsToDuts (dut_id),
    CONSTRAINT fk_variantsToDuts FOREIGN KEY (dut_id) REFERENCES duts(dut_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_variantsTovc FOREIGN KEY (v_id) REFERENCES variant_changer(v_id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS usb_mux (
    um_id INT AUTO_INCREMENT PRIMARY KEY,
    um_manufacturer VARCHAR(40) NOT NULL,
    um_model VARCHAR(40) NOT NULL,
    um_name VARCHAR(40) NOT NULL,
    um_number INT NOT NULL,
    um_inputs INT NOT NULL,
    um_outputs INT NOT NULL,
    um_serial INT NOT NULL,
    um_l_id INT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS myduts (
    md_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    md_serialnr VARCHAR(50) NOT NULL,
    mdt_id INT UNSIGNED NOT NULL,
    md_config VARCHAR(255) NOT NULL,
    KEY fk_mdt_id (mdt_id),
    CONSTRAINT fk_mdt_id FOREIGN KEY (mdt_id) REFERENCES myduttype(mdt_id) ON DELETE NO ACTION ON UPDATE NO ACTION
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)

  await pool.execute(`CREATE TABLE IF NOT EXISTS myduts_duts (
    md_id INT UNSIGNED NOT NULL,
    dut_id INT NOT NULL,
    UNIQUE KEY md_id (md_id),
    UNIQUE KEY dut_id (dut_id),
    CONSTRAINT fk_dutmd_id FOREIGN KEY (md_id) REFERENCES myduts(md_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_mddut_id FOREIGN KEY (dut_id) REFERENCES duts(dut_id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci`)
}
