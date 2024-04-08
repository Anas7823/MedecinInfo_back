const express = require('express')
const app = express()
const cors = require('cors')
const mariadb = require('./bdd')
const bcrypt = require("bcryptjs");

app.use(cors())
app.use(express.json())


app.get('/medecin', async(req, res) => {
    let conn;
    console.log('Connexion')
    try{
        conn = await mariadb.pool.getConnection();
  
        const rows = await conn.query('SELECT * FROM medecins');
        console.log(Date());
        res.status(200).json(rows)
        console.log("Serveur à l'écoute");
    }catch(err){
        console.log(err)
        throw err;
    }finally{
        if (conn) return conn.end();
    }
})

app.listen(8000, () =>{
    console.log("Serveur à l'écoute");
} )


module.exports = app