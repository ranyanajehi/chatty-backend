import { CustomError, IErrorResponse } from './globals/helpes/error-handler';
import {Application, json,urlencoded, Response,Request,NextFunction} from 'express';
import http from'http';
import hpp from 'hpp';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookierSession from 'cookie-session';
import HTTP_STATUS from 'http-status-codes';
import 'express-async-error';
import { config } from './config';
import {Server} from 'socket.io';
import { createClient } from 'redis';
import  {createAdapter} from '@socket.io/redis-adapter';
import applicationRoutes from './routes';
import Logger from 'bunyan';
const SERVER_PORT=5000;

const log: Logger = config.createLogger('server');

export class chattyServer{

    private app:Application;

    constructor(app:Application)
    {
        this.app=app;
    }
    public start():void{

        this.securityMiddelwaire(this.app);
        this.standarMiddlwaire(this.app);
        this.routeMiddlwaire(this.app);
        this.startServer(this.app);
        this.globaleErrorHandler(this.app);
    }

    private securityMiddelwaire(app:Application):void{
              app.use(cookierSession(
                 {name:'session',
                 keys:[config.SECRET_KEY_ONE!,config.SECRET_KEY_TWO!],
                 maxAge:24*7*3600000,
                 secure:config.NODE_ENV!=='developpment'

                }));
                app.use(hpp());
                app.use(helmet());
                app.use(
                    cors({
                        origin:config.CLIENT_URL,
                        credentials:true,
                        optionsSuccessStatus:200,
                        methods:['GET','POST','PUT','DELETE','OPTIONS']


                    })
                );


    }
    private standarMiddlwaire(app:Application):void{
         app.use(compression());
         app.use(json({limit:'50mb'}));
         app.use(urlencoded({extended:true,limit:'50mb'}));



    }
    private routeMiddlwaire(app:Application):void{
        applicationRoutes(app);
    }


    private globaleErrorHandler(app:Application):void{
        app.all('*',(req:Request,res:Response)=>{
            res.status(HTTP_STATUS.NOT_FOUND).json({message:`${req.originalUrl} not found`});
        });
        app.use((error: IErrorResponse, _req: Request, res: Response, next: NextFunction) => {
            log.error(error);

            if(error instanceof CustomError){
                   return res.status(error.statusCode).json(error.serializeError());
            }
            next();

        });
    }



    private async startServer(app:Application):Promise<void>{
        try{
          const httpServer:http.Server=new http.Server(app);
          const socketIo:Server= await this.createSocketIO(httpServer);
          this.startHttpServer(httpServer);
          this.socketIoConnections(socketIo);
        }
        catch(error){
            log.error(error);

        }
    }
    private async createSocketIO(httpServer:http.Server):Promise<Server>{
        const io:Server=new Server(httpServer, {
            cors:{
                origin:config.CLIENT_URL,
                methods:['GET','POST','PUT','DELETE','OPTIONS']    }
        } );
        const pubClient=createClient({url:config.REDIS_HOST});
        const subClient= pubClient.duplicate();
        await Promise.all([pubClient.connect(),subClient.connect()]);
        io.adapter(createAdapter(pubClient,subClient));

        return io;
    }
    private startHttpServer(httpServer:http.Server):void{
        log.info(`Server has started with process ${process.pid}`);

        httpServer.listen(SERVER_PORT,()=>{
            log.info(`server runing on port : ${SERVER_PORT}`);
        });
    }

    private socketIoConnections(io:Server):void{

    }

}
