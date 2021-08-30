import * as mysql from 'mysql2'
import { FieldPacket, QueryError, RowDataPacket } from 'mysql2'
import * as path from 'path'
import * as cp from 'child_process'

export default class MyImporter { 
    pool:mysql.Pool = null;
    mysqlBaseDir:string = null;
    mysqlExecutable:string = null;

    hostname:string = null; 
    port:number = null; 
    username:string = null; 
    password:string = null; 
    database:string = null; 

    constructor (hostname:string, port:number, username:string, password:string, database:string ){
        this.hostname = hostname; 
        this.port = port; 
        this.username = username; 
        this.password = password; 
        this.database = database; 
    }

    init = () => {
        // -- console.log('initialize');

        return new Promise((resolve, reject) => {

            // check
            if(this.hostname != '127.0.0.1' && this.hostname != 'localhost')
            {
                reject('This module only works on locally installed databases');
            }

            this.pool = mysql.createPool({
                connectionLimit: 10,
                host: this.hostname,
                port: this.port,
                user: this.username,
                password: this.password,
                multipleStatements: true
            });

            this.pool.getConnection((error:any, connection:mysql.PoolConnection) => {
                if (error) {
                    reject(error)
                }
                else
                {
                    resolve('true');
                }
            });

        });
    }    

    dropDatabaseIfExists = () => {
        return new Promise(function(resolve, reject){
            // WE USE DIRECT QUERY BECAUSE THE MYSQL MODULE DOES NOT PROPERLY HANDLE QUOTATION MARKS WITH THIS TYPE OF QUERY
            this.pool.query('DROP DATABASE IF EXISTS ' + this.database, (error:QueryError, results: RowDataPacket, fields: FieldPacket) => {
                // -- console.dir(results)
                if(error)
                {
                    reject(error);
                }
                else
                {
                    resolve(results);
                }
            });
        });

    }

    createDatabaseIfDoesNotExist = () => {
        // -- console.log('create database')
        return new Promise(function (resolve, reject) {
            // WE USE DIRECT QUERY BECAUSE MYSQL MODULE DOES NOT PROPERLY HANDLE QUOTATION MARKS
            this.pool.query('CREATE DATABASE IF NOT EXISTS ' + this.database, (error:QueryError, results: RowDataPacket, fields: FieldPacket) => {
                // -- console.dir(results)
                if (error) {
                    reject(error);
                }
                else {
                    resolve(results);
                }
            });
        });        
    }


    execute = (file:string) => {
        // -- console.log('execute');

        return new Promise((resolve, reject) => {

            this.pool.query(`SHOW VARIABLES LIKE 'basedir'`, (error:QueryError, results: RowDataPacket, fields: FieldPacket) => {
                if(error)
                {
                    reject(error);
                }
                else
                {
                    if(results.length == 0)
                    {
                        reject('MySQL was not found');
                    }
                    else
                    {
                        var command = null;

                        this.mysqlBaseDir = results[0]['Value'];

                        if (process.platform === "win32")
                        {
                            this.mysqlExecutable = path.resolve(this.mysqlBaseDir, 'bin/mysql.exe');
                            command = '"{executable}" -u{username} -p{password} {database} < {file}';
                        }
                        else
                        {
                            this.mysqlExecutable = 'mysql';
                            command = '{executable} -u{username} -p{password} {database} < {file}';
                        }

                        command = command.replace('{executable}', this.mysqlExecutable);
                        command = command.replace('{username}', this.username);
                        command = command.replace('{password}', this.password);
                        command = command.replace('{database}', this.database);
                        command = command.replace('{file}', file);

                        cp.exec(command, (error, stdout, stderr) => {
                            if(error)
                            {
                                reject(error)
                            }
                            else
                            {
                                // final check
                                this.pool.query('USE ' + this.database +';SHOW TABLES;', (checkerr:QueryError, checkresults: RowDataPacket, fields: FieldPacket) =>{
                                    if(checkerr)
                                    {
                                        reject(checkerr);
                                    }
                                    else
                                    {
                                        if(checkresults.length == 2)
                                        {
                                            resolve('success, database was imported')
                                        }
                                        else
                                        {
                                            reject('fail, unknown import error, see console output for info');
                                        }
                                    }
                                })
                            }
                        });
                        
                    }
                    
                }
            });


        })

    }
}