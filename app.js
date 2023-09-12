require('dotenv').config();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = path.join(process.env.DIR_BACKUPS, datetime());
createDir(dir);

// Abra o arquivo em modo de escrita (ou crie se não existir)
const log_file = fs.createWriteStream(path.join(dir, 'logs.txt'), { flags: 'a' });

// Redirecione a saída do console para o arquivo
const originalConsoleLog = console.log;
console.log = function (mensagem) {
    const data = new Date().toLocaleString();
    const mensagemFormatada = `[${data}] ${mensagem}\n`;
    log_file.write(mensagemFormatada);
    originalConsoleLog.apply(console, arguments); // Chame o console.log original
};

function datetime() {
    const data = new Date();

    const year = data.getFullYear();
    const month = String(data.getMonth() + 1).padStart(2, '0');
    const day = String(data.getDate()).padStart(2, '0');
    const hour = String(data.getHours()).padStart(2, '0');
    const minutes = String(data.getMinutes()).padStart(2, '0');
    const seconds = String(data.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hour}${minutes}${seconds}`;
}

function createDir(dir) {
    const part = dir.split(path.sep);

    for (let i = 1; i <= part.length; i++) {
        const current = part.slice(0, i).join(path.sep);

        if (!fs.existsSync(current)) {
            fs.mkdirSync(current);
        }
    }
}

async function backup() {
    if (!process.env.DIR_DATABASES) {
        console.log('❌ Variável de ambiente "DIR_DATABASES" não econtrada');
        return Promise.reject();
    }
    if (!process.env.DIR_BACKUPS) {
        console.log('❌ Variável de ambiente "DIR_BACKUPS" não econtrada');
        return Promise.reject();
    }

    let connections;
    try {
        connections = JSON.parse(fs.readFileSync(process.env.DIR_DATABASES, 'utf-8'));
    } catch (err) {
        console.log('❌ ' + err.message)
        return Promise.reject();
    }

    //console.log(connections);
    for (const connection of connections) {
        let db = {};
        db.active = connection.active ?? true;
        db.title = connection.title ?? connection.host ?? '';
        db.host = connection.host ?? '';
        db.user = connection.user ?? '';
        db.password = connection.password ?? connection.pwd ?? '';

        db.databases = [];
        if (typeof connection.database == 'string') {
            db.databases.push(connection.database);
        }
        if (typeof connection.databases == 'string') {
            db.databases.push(connection.databases);
        }
        if (typeof connection.database == 'object') {
            db.databases.push(...connection.database);
        }
        if (typeof connection.databases == 'object') {
            db.databases.push(...connection.databases);
        }

        console.log('')
        console.log(`${db.active ? '🟢' : '⚫'} Conexão: ${db.title} ${!db.active && '[inativo]' || ''}`)
        if (db.active) {
            for (const database of db.databases) {
                db.database = database;
                await backupDatabase(db);
            }
        }
    }
}

async function backupDatabase(db) {
    let dir_bkp = path.join(dir, db.host);
    createDir(dir_bkp);

    console.log('')
    console.log(`Host: ${db.host}`)
    console.log(`Usuário: ${db.user}`)
    console.log(`Banco de Dados: ${db.database}`)

    return new Promise((resolve, reject) => {
        const command = `mysqldump -h ${db.host} -u ${db.user} -p${db.password} --skip-column-statistics ${db.database} > "${dir_bkp}\\${db.database}.sql"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.log(`❌ Erro ao criar backup: ${error.message}`);
            } else {
                console.log(`✔️ Backup criado com sucesso`);
            }
            resolve();
        });
    });
}



backup()
    .then(() => {
        console.log('')
        console.log('🟢 Rotina processada com sucesso.');
    })
    .catch((err) => {
        console.log('')
        console.log('🔴 ', (err ?? 'Erro ao processar rotina'));
    });

//✅☑️✔️❌❎🔴🟠🟡🟢🔵🟣⚪⚫