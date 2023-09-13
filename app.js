require('dotenv').config();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra');

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
        const command = `mysqldump --force -h ${db.host} -u ${db.user} -p${db.password} --skip-column-statistics ${db.database} --single-transaction > "${dir_bkp}\\${db.database}.sql"`;

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


function removeOldBackups() {
    const regex = /^\d{4}-\d{2}-\d{2} \d{6}$/;

    fs.readdir(process.env.DIR_BACKUPS, (err, files) => {
        console.log('');

        let qt = process.env.QT_BACKUP ?? 0;
        qt = +qt;
        if (qt <= 0) {
            console.log('Não remover backups antigos');
            return;
        }

        console.log(qt)
        let pls = (qt > 1 && "s" || '')
        console.log(`Manter somente o${pls} último${pls} ${qt} backup${pls}`);


        // Crie um array de objetos com informações de diretório e data de modificação
        const directories = files.map(file => {
            const dirPath = path.join(process.env.DIR_BACKUPS, file);
            const stats = fs.statSync(dirPath);
            return { path: dirPath, mtime: stats.mtime };
        }).filter(item => {
            return (regex.test(path.basename(item.path)));
        });

        // Ordene os diretórios pela data de modificação em ordem decrescente (mais recente primeiro)
        directories.sort((a, b) => b.mtime - a.mtime);

        // Mantenha apenas os 5 diretórios mais recentes
        const keep = directories.slice(0, process.env.QT_BACKUP);
        console.log(keep)

        // Remova os diretórios que não estão na lista de diretórios para manter
        directories.forEach(dir => {
            if (!keep.includes(dir)) {
                fsExtra.remove(dir.path, err => {
                    if (err) {
                        console.log(`❌ Erro ao remover diretório ${dir.path}:`, err);
                    } else {
                        console.log(`✔️ Diretório removido: ${dir.path}`);
                    }
                });
            }
        });
    });
}


backup()
    .then(() => {
        removeOldBackups();
        console.log('')
        console.log('🟢 Rotina processada com sucesso.');
    })
    .catch((err) => {
        console.log('')
        console.log('🔴 ', (err ?? 'Erro ao processar rotina'));
    });

//✅☑️✔️❌❎🔴🟠🟡🟢🔵🟣⚪⚫