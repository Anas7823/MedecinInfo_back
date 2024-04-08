const mariadb = require('mariadb')
require('dotenv').config()

const pool = mariadb.createPool({
    host: process.env.DB_Host,
    database : process.env.DB_DTB,
    user : process.env.DB_User,
    password : process.env.DB_PWD
})

module.exports = Object.freeze({
      pool: pool
    });