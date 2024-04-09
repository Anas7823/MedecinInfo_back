const express = require('express')
const app = express()
const cors = require('cors')
const mariadb = require('./bdd')
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const session = require('express-session') // https://expressjs.com/en/resources/middleware/session.html

app.use(cors())
app.use(express.json())

app.use(session({
    name: process.env.SESSION_NAME, // session id
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 semaine
      secure: false, // true en production
    },
}))

// Recuperer la liste des medecins
app.get('/medecin', async(req, res) => {
    let conn;
    console.log('Connexion')
    try{
        conn = await mariadb.pool.getConnection();
  
        const rows = await conn.query('SELECT * FROM medecins');
        res.status(200).json(rows)
        console.log("Serveur à l'écoute");
    }catch(err){
        console.log(err)
        throw err;
    }finally{
        if (conn) return conn.end();
    }
})

// Recuperer un medecin
app.get('/medecin/:id', async(req, res) => {
    let conn;
    console.log('Connexion')
    try{
        conn = await mariadb.pool.getConnection();
  
        const rows = await conn.query('SELECT * FROM medecins WHERE id = ?', [req.params.id]);
        res.status(200).json(rows)
        console.log("Serveur à l'écoute");
    }catch(err){
        console.log(err)
        throw err;
    }finally{
        if (conn) return conn.end();
    }
})


// Nouveau medecin A NE PAS METTRE DANS LE FRONT
app.post('/medecin', async (req, res) => {
    console.log('Connexion')
    console.log("body: " + JSON.stringify(req.body));
    
    let { nom, prenom, specialite, identifiant, mdp } = req.body;
    
    const saltRounds = 10;
    
    if (!identifiant || !mdp) {
        return res.status(400).json({ message: 'Veuillez saisir une adresse e-mail et un mot de passe.' });
    }

    try {
        let exist = await mariadb.pool.query('SELECT * FROM medecins WHERE identifiant = ?', [identifiant]);
        if (exist.length > 0) {
            return res.status(400).json({ message: 'Cet identifiant est déjà utilisé.' });
        }
        const hashedPassword = await bcrypt.hash(mdp, saltRounds);
        const conn = await mariadb.pool.getConnection();
        await conn.query('INSERT INTO medecins (nom, prenom, specialite, identifiant, mdp) VALUES (?, ?, ?, ?, ?)', [nom, prenom, specialite, identifiant, hashedPassword]);
        const rows = await conn.query('SELECT * FROM medecins;')    
        req.session.id = rows[0].id; // On stocke l'id de l'utilisateur dans la session
        console.log(req.session.id);
        res.status(200).json({ message: "Utilisateur ajouté" });
        console.log("Serveur à l'écoute");
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Une erreur est survenue lors de l\'inscription du médecin.' });
    }
});

// Connexion medecin
app.post('/medecin/login', async(req, res) => {
    let conn;
    console.log('Connexion')
    try{
        conn = await mariadb.pool.getConnection();
  
        const rows = await conn.query('SELECT * FROM medecins WHERE identifiant = ?', [req.body.identifiant]);
        if (rows.length > 0) {
            if (bcrypt.compareSync(req.body.mdp, rows[0].mdp)) {
                req.session.id_medecin = rows[0].id; // On stocke l'id du médecin dans la session
                const token = jwt.sign({ sub: rows[0].id }, 'secret_key'); // On génère un token
                console.log("token = " + req.session.id);
                console.log("session = " + req.session.id_medecin);

                res.status(200).json({message: "Connexion réussie", token: token, id_medecin: rows[0].id});
            } else {
                res.status(401).json({message: "Mot de passe incorrect"})
            }
        } else {
            res.status(404).json({message: "Utilisateur non trouvé"})
        }
        console.log("Serveur à l'écoute");
    }catch(err){
        console.log(err)
        throw err;
    }finally{
        if (conn) return conn.end();
    }
})

// Deconnexion medecin
app.get('/medecin/logout', async(req, res) => {
    req.session.destroy();
    res.status(200).json({message: "Déconnexion réussie"});
})

/////////////////////////////////////////// PATIENTS (CRUD) ///////////////////////////////////////////

// Liste des patients
app.get('/patients', async(req, res) => {
    let conn;
    console.log('Connexion')
    try{
        conn = await mariadb.pool.getConnection();
  
        const rows = await conn.query('SELECT * FROM patients');
        res.status(200).json(rows)
        console.log("Liste de tout les patients récupérée");
    }catch(err){
        console.log(err)
        throw err;
    }
})

// Liste des patients d'un medecin que seul le medecin peut voir
app.get('/medecin/:id_medecin/patients', async(req, res) => {
    let conn;
    console.log('Connexion')
    let id_medecin = req.session.id_medecin;
    console.log("id_medecin "+id_medecin);
    id_medecin_url = req.params.id_medecin;

    if (id_medecin != id_medecin_url) {
        return res.status(401).json({message: "Vous n'êtes pas autorisé à voir cette liste de patients"});
    }
    try{
        conn = await mariadb.pool.getConnection();
        const rows = await conn.query('SELECT * FROM patients WHERE id_medecin = ?', [id_medecin]);
        res.status(200).json(rows)
        console.log("Liste des patients récupérée");
    }catch(err){
        console.log(err)
        throw err;
    }
})

// Voir un patient que seul le medecin peut voir
app.get('/medecin/patients/:id', async(req, res) => {
    let conn;
    console.log('Connexion')
    let id_medecin = req.session.id_medecin;
    console.log("id_medecin "+id_medecin);
    try{
        conn = await mariadb.pool.getConnection();
        const rows = await conn.query('SELECT * FROM patients WHERE id = ? AND id_medecin = ?', [req.params.id, id_medecin]);
        res.status(200).json(rows)
        console.log("Patient récupéré");
    }catch(err){
        console.log(err)
        throw err;
    }
})


// Nouveau patient
app.post('/patient', async (req, res) => {
    console.log('Connexion')
    console.log("body: " + JSON.stringify(req.body));
    
    let { nom, prenom } = req.body;
    
    // id_medecin est récupéré à l'aide de la session
    let id_medecin = req.session.id_medecin;
    console.log("id_medecin = " + id_medecin);
    try {
        const conn = await mariadb.pool.getConnection();
        await conn.query('INSERT INTO patients (nom, prenom, id_medecin) VALUES (?, ?, ?)', [nom, prenom, id_medecin]);
        const rows = await conn.query('SELECT * FROM patients;') 
        res.status(200).json({ message: "Patient ajouté" });
        console.log("Nouveau patient ajouté");
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Une erreur est survenue lors de l\'ajout du patient.' });
    }
});

/////////////////////////////////////////// Traitement (CRUD) ///////////////////////////////////////////

// Liste des traitements
app.get('/traitements', async(req, res) => {
    let conn;
    console.log('Connexion')
    try{
        conn = await mariadb.pool.getConnection();
  
        const rows = await conn.query('SELECT * FROM traitement');
        res.status(200).json(rows)
        console.log("Liste de tout les traitements récupérée");
    }catch(err){
        console.log(err)
        throw err;
    }
})

// Liste des traitements d'un patient que seul le medecin peut voir
app.get('/patient/:id_patient/traitements', async(req, res) => {
    let conn;
    console.log('Connexion')
    let id_medecin = req.session.id_medecin;
    console.log("id_medecin "+id_medecin);
    try{
        conn = await mariadb.pool.getConnection();
        const rows = await conn.query('SELECT * FROM traitement WHERE id_patient = ? AND id_medecin = ?', [req.params.id_patient, id_medecin]);
        res.status(200).json(rows)
        console.log("Liste des traitements récupérée");
    }catch(err){
        console.log(err)
        throw err;
    }
})

// Nouveau traitement pour un patient que seul le medecin peut ajouter
app.post('/new_traitement/patient/:id_patient', async (req, res) => {
    console.log('Connexion')
    console.log("body: " + JSON.stringify(req.body));
    
    let traitement  = req.body.medicaments;
    
    // id_medecin est récupéré à l'aide de la session
    let id_medecin = req.session.id_medecin;
    console.log("id_medecin = " + id_medecin);
    try {
        const conn = await mariadb.pool.getConnection();
        await conn.query('INSERT INTO traitement (id_patient, medicaments, id_medecin) VALUES (?, ?, ?)', [req.params.id_patient, traitement, id_medecin]);
        res.status(200).json({ message: "Traitement ajouté" });
        console.log("Nouveau traitement ajouté");
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Une erreur est survenue lors de l\'ajout du traitement.' });
    }
});

// Supprimer un traitement, seul le medecin peut supprimer
app.delete('/traitement/:id', async(req, res) => {
    let conn;
    console.log('Connexion')
    let id_medecin = req.session.id_medecin;
    console.log("id_medecin = " + id_medecin);
    try{
        conn = await mariadb.pool.getConnection();
        await conn.query('DELETE FROM traitement WHERE id = ? AND id_medecin = ?', [req.params.id, id_medecin]);
        res.status(200).json({message: "Traitement supprimé"});
        console.log("Traitement supprimé");
    }catch(err){
        console.log(err)
        throw err;
    }
})

// Modifier un traitement que seul le medecin peut modifier
app.put('/traitement/:id', async(req, res) => {
    let conn;
    console.log('Connexion')
    let id_medecin = req.session.id_medecin;
    console.log("id_medecin = " + id_medecin);
    try{
        conn = await mariadb.pool.getConnection();
        await conn.query('UPDATE traitement SET medicaments = ? WHERE id = ? AND id_medecin = ?', [req.body.medicaments, req.params.id, id_medecin]);
        res.status(200).json({message: "Traitement modifié"});
        console.log("Traitement modifié");
    }catch(err){
        console.log(err)
        throw err;
    }
})


/////////////////////////////////////////// Rendez vous ///////////////////////////////////////////

// Liste des rendez-vous
app.get('/rdvs', async(req, res) => {
    let conn;
    console.log('Connexion')
    try{
        conn = await mariadb.pool.getConnection();
        const rows = await conn.query('SELECT * FROM rendez_vous');
        res.status(200).json(rows)
        console.log("Liste de tout les rendez-vous récupérée");
    }catch(err){
        console.log(err)
        throw err;
    }
})

// Liste des rendez-vous d'un medecin que seul lui peut voir
app.get('/medecin/:id_medecin/rdvs', async(req, res) => {
    let conn;
    console.log('Connexion')
    let id_medecin = req.session.id_medecin;
    console.log("id_medecin "+id_medecin);
    try{
        conn = await mariadb.pool.getConnection();
        const rows = await conn.query('SELECT * FROM rendez_vous WHERE id_medecin = ?', [id_medecin]);
        res.status(200).json(rows)
        console.log("Liste des rendez-vous récupérée");
    }catch(err){
        console.log(err)
        throw err;
    }
})

// Liste des rendez-vous d'un patient que seul le medecin peut voir
app.get('/patient/:id_patient/rdvs', async(req, res) => {
    let conn;
    console.log('Connexion')
    let id_medecin = req.session.id_medecin;
    console.log("id_medecin "+id_medecin);
    try{
        conn = await mariadb.pool.getConnection();
        const rows = await conn.query('SELECT * FROM rendez_vous WHERE id_patient = ? AND id_medecin = ?', [req.params.id_patient, id_medecin]);
        res.status(200).json(rows)
        console.log("Liste des rendez-vous récupérée");
    }catch(err){
        console.log(err)
        throw err;
    }
})

// Nouveau rendez-vous pour un patient que seul le medecin peut faire
app.post('/new_rdv/patient/:id_patient', async (req, res) => {
    console.log('Connexion')
    console.log("body: " + JSON.stringify(req.body));
    
    let { date, heure } = req.body;
    
    // id_medecin est récupéré à l'aide de la session
    let id_medecin = req.session.id_medecin;
    console.log("id_medecin = " + id_medecin);
    try {
        const conn = await mariadb.pool.getConnection();
        await conn.query('INSERT INTO rendez_vous (id_patient, date, heure, id_medecin) VALUES (?, ?, ?, ?)', [req.params.id_patient, date, heure, id_medecin]);
        res.status(200).json({ message: "Rendez-vous ajouté" });
        console.log("Nouveau rendez-vous ajouté");
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Une erreur est survenue lors de l\'ajout du rendez-vous.' });
    }
});

// Supprimer un rendez-vous, seul le medecin peut supprimer
app.delete('/rdv/:id', async(req, res) => {
    let conn;
    console.log('Connexion')
    let id_medecin = req.session.id_medecin;
    console.log("id_medecin = " + id_medecin);
    try{
        conn = await mariadb.pool.getConnection();
        await conn.query('DELETE FROM rendez_vous WHERE id = ? AND id_medecin = ?', [req.params.id, id_medecin]);
        res.status(200).json({message: "Rendez-vous supprimé"});
        console.log("Rendez-vous supprimé");
    }catch(err){
        console.log(err)
        throw err;
    }
})



app.listen(8000, () =>{
    console.log("Serveur à l'écoute sur http://localhost:8000");
} )


module.exports = app