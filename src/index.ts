import mysqldump from 'mysqldump'
import { SchemaDumpOptions } from 'mysqldump'
import * as fs from 'fs'
import * as mysql from 'mysql2'
import { DataDef, IAppConfig } from './config'
import { FieldPacket, RowDataPacket } from 'mysql2'
import * as pbars from 'cli-progress'
import * as path from 'path'

var appConfig: IAppConfig;
var appDirName: string = '';

if (__dirname.toUpperCase().includes('SNAPSHOT')) {
    appDirName = path.dirname(process.execPath);
    console.log(`Log: application compiled to exe`);
} else {
    appDirName = __dirname;
    console.log(`Log: application debug src`);
}

// ## LOGGER

var logdirpath = path.join(appDirName, 'log');

if (!fs.existsSync(logdirpath)) {
    fs.mkdirSync(logdirpath);
}

const opts = {
    errorEventName:'error',
    logDirectory: logdirpath,
    fileNamePattern:'mydump-<DATE>.log',
    dateFormat:'YYYY.MM.DD'
};

const log = require('simple-node-logger').createRollingFileLogger( opts );

const LogInfo = (data:string, showInConsole:boolean = true) => {
    log.info(data);
    if (showInConsole)
        console.log(data); 
}

const LogError = (data:string) => {
    log.error(data);
    console.log(data); 
}

const LogWarning = (data:string) => {
    log.warn(data);
    console.log(data); 
}

// ## LOGGER

try {
    appConfig = JSON.parse(fs.readFileSync(`${appDirName}\\config.json`).toString()) as IAppConfig;
    LogInfo(`Pass: file config founded.`);
} catch (error) {
    appConfig = DataDef;
    LogWarning(`Warning: file config no found use default, ${error}`);
}

var inconn = mysql.createConnection({
    host: appConfig.exportDatabase.host,
    user: appConfig.exportDatabase.user,
    password: appConfig.exportDatabase.password,
    database: appConfig.exportDatabase.database
});

var outpath = path.join(appDirName, appConfig.exportDatabase.database);

if (!fs.existsSync(outpath)) {
    fs.mkdirSync(outpath);
}

var SchemaDef: SchemaDumpOptions = {
    format: false,
    autoIncrement: true,
    engine: true,
    table: {
        ifNotExist: true,
        dropIfExist: true,
        charset: true,
    },
    view: {
        exclude: true
    }
};

const ExportPromise = () => {
    return new Promise((resolve, rejects) => {
        fs.exists(outpath, (exists: boolean) => {
            if (exists) {
                inconn.query('SHOW TABLES', async (err, results: RowDataPacket, fields: FieldPacket) => {
                    if (err) {
                        return rejects(`Error: Mysql error - ${err}` );
                    }

                    var data: any = JSON.parse(JSON.stringify(results));
                    var flds: any = JSON.parse(JSON.stringify(fields));

                    const bar1: pbars.SingleBar = new pbars.SingleBar(
                        { format: 'Data Export [{bar}] {percentage}% | ETA: {eta}s | {value}/{total} | Current Table: {table} | Time : {time}' },
                        pbars.Presets.shades_classic);

                    LogInfo(`Start dumping time : ${new Date()}`);
                    bar1.start(data.length, 0, { table: "None", time: new Date() });

                    var _tables: Array<string> = [];
                    var _schema: false | SchemaDumpOptions;
                    var _useReplace: boolean;

                    for (let current of data) {
                        LogInfo(`Dumping TABLE : ${current[flds[0]['name']]}`, false);
                        bar1.increment({ table: current[flds[0]['name']], time: new Date() });

                        _tables = [];
                        _tables.push(current[flds[0]['name']]);

                        _useReplace = (appConfig.tables && appConfig.tables[current[flds[0]['name']]]) ? appConfig.tables[current[flds[0]['name']]].useReplace || false : false
                        if (_useReplace)
                            _schema = false;
                        else
                            _schema = (appConfig.tables && appConfig.tables[current[flds[0]['name']]]) ? (appConfig.tables[current[flds[0]['name']]].schema && true) ? SchemaDef : false
                                : SchemaDef

                        try{
                            await mysqldump({
                                connection: {
                                    host: appConfig.exportDatabase.host,
                                    user: appConfig.exportDatabase.user,
                                    password: appConfig.exportDatabase.password,
                                    database: appConfig.exportDatabase.database
                                },
                                dumpToFile: `${outpath}/${current[flds[0]['name']]}.sql`,
                                dump: {
                                    schema: _schema,
                                    tables: _tables,
                                    data: {
                                        where: {
                                            [current[flds[0]['name']]]: appConfig.tables
                                                ? appConfig.tables[current[flds[0]['name']]] ? appConfig.tables[current[flds[0]['name']]].where || '' : ''
                                                : ''
                                        },
                                        lockTables: false,
                                        format: false,
                                        verbose: false,
                                        useReplace: _useReplace,
                                        dropIndex: appConfig.dropIndex ? true : false
                                    },
                                    trigger: false
                                }
                            });
                        } catch(err){
                            rejects(err);
                        }
                    }
                    bar1.stop();

                    resolve(null);

                });
            } else rejects('Error: No direcory dumping exists')
        });
    });
}

const Importer = require('mysql-import');

const ImportPromiseUseLib = () => {
    return new Promise(async (resolve, rejects) => {

        if (appConfig.importDatabase) {
            
            LogInfo('Import use Lib');

            const importer = new Importer(
                {
                    host: appConfig.importDatabase.host,
                    user: appConfig.importDatabase.user,
                    password: appConfig.importDatabase.password,
                    database: appConfig.importDatabase.database
                });

            let files = fs.readdirSync(outpath, { withFileTypes: true })
                .filter(dirent => dirent.isFile())
                .map(dirent => dirent.name)
                .sort((a, b) => {
                    return fs.statSync(`${outpath}/${a}`).size - fs.statSync(`${outpath}/${b}`).size;
                });

            const bar1: pbars.SingleBar = new pbars.SingleBar(
                { format: 'Data Import [{bar}] {percentage}% | ETA: {eta}s | {value}/{total} | Current Files: {file} | Time : {time}' },
                pbars.Presets.shades_classic);

            bar1.start(files.length, 0, { file: "None", time: new Date() });
            for (let current of files) {
                LogInfo(`Import FILE : ${current}`, false);
                bar1.increment({ file: current, time: new Date() })
                try {
                    await importer.import(`${outpath}/${current}`);
                } catch (err) {
                    rejects(err);
                }
            }
            bar1.stop();

            resolve('done');
        } else {
            resolve('skip::No import configuration found.')
        }
    });
}

import MyImporter from './mysql-import'

const ImportPromiseUseMy = () => {
    return new Promise(async (resolve, rejects) => {

        if (appConfig.importDatabase) {
            LogInfo('Import use My');

            let files = fs.readdirSync(outpath, { withFileTypes: true })
                .filter(dirent => dirent.isFile())
                .filter(dirent => dirent.name.endsWith('.sql'))
                .map(dirent => dirent.name)
                .sort((a, b) => {
                    return fs.statSync(`${outpath}/${a}`).size - fs.statSync(`${outpath}/${b}`).size;
                });

            const bar1: pbars.SingleBar = new pbars.SingleBar(
                { format: 'Data Import [{bar}] {percentage}% | ETA: {eta}s | {value}/{total} | Current Files: {file} | Time : {time}' },
                pbars.Presets.shades_classic);

            let importer = new MyImporter(appConfig.importDatabase.host, 3306, appConfig.importDatabase.user, appConfig.importDatabase.password,  appConfig.importDatabase.database);
            bar1.start(files.length, 0, { file: "None", time: new Date() });
            try {
                await importer.init();
                for (let current of files) {
                    LogInfo(`Import FILE : ${current}`, false);
                    bar1.increment({ file: current, time: new Date() })
                    try {
                        await importer.execute(`${outpath}/${current}`);
                    } catch (err) {
                        rejects(err);
                    }
                }
            } catch(err){
                rejects(err);
            }
            bar1.stop();

            resolve('done');
        } else {
            resolve('skip::No import configuration found.')
        }
    });
}

const ImportPromise = (appConfig.useMySQLImport) ?  ImportPromiseUseMy  :  ImportPromiseUseLib; 

let args = process.argv.slice(2);

if (args.length>0) {
    if (args[0]=='/export') {
        ExportPromise().then(() => {
            LogInfo(`Export Succesfull at : ${new Date()}`);
        }).catch((err) => { LogError(err); process.exit(); });    
    } else 
    if (args[0]=='/import') {
        ImportPromise().then((data) => {
            LogInfo(`Import Succesfull at : ${new Date()} - ${data}`);
            process.exit();
        }).catch(err => { LogError(err); process.exit(); })
    }
} else {
    ExportPromise().then(() => {
        LogInfo(`Export Succesfull at : ${new Date()}`);
        ImportPromise().then((data) => {
            LogInfo(`Import Succesfull at : ${new Date()} - ${data}`);
            process.exit();
        }).catch(err => { LogError(err); process.exit(); })
    }).catch((err) => { LogError(err); process.exit(); });
}
