export interface ITableConfigDump {
    
    where?: string;
    
    useReplace?: boolean;

    schema?: boolean;
    
}

export interface IConnentionParams {

    host: string;

    user: string;

    password: string;

    database: string;
}

export interface IAppConfig {
    exportDatabase: IConnentionParams,
    importDatabase?: IConnentionParams,
    useMySQLImport?: Boolean,
    dropIndex?:Boolean,
    tables?:{ 
        [k:string]: ITableConfigDump;
    }
}

export const DataDef : IAppConfig = {
    exportDatabase: {
        host: 'localhost',
        user: 'root',
        password: 'Pra$$1.R00t',
        database: 'prfsa0001'
    },
    importDatabase: {
        host: 'localhost',
        user: 'prassipv',
        password: 'issarp06',
        database: 'prfim0001'
    },
    tables : {
        d_vbscte00 : { 
            where: `taareg >= ${new Date().getFullYear().toString()}`,
            useReplace: true,
            schema: false
        },
        d_vbscde00 : { 
            where: `daareg >= ${new Date().getFullYear().toString()}`,
            useReplace: true,
            schema: false
        },
        d_vbsciv00 : { 
            where: `iaareg >= ${new Date().getFullYear().toString()}`,
            useReplace: true,
            schema: false
        },
        d_vbmvcs00 : { 
            where: `maareg >= ${new Date().getFullYear().toString()}`,
            useReplace: true,
            schema: false
        },
        d_mffbtc00 : { 
            where: `maareg >= ${new Date().getFullYear().toString()}`,
            useReplace: true,
            schema: false
        },
        d_mffbde00 : { 
            where: `daareg >= ${new Date().getFullYear().toString()}`,
            useReplace: true,
            schema: false
        },
        d_mffbte00 : { 
            where: `faareg >= ${new Date().getFullYear().toString()}`,
            useReplace: true,
            schema: false
        }
    }

}
