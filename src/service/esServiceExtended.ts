import { ConfigService, ESService, ESServiceLimited, logger } from "rest.portal";
import { ConfigWatch } from "rest.portal/model/config";
import { BroadcastService } from "./broadcastService";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');


/**
 * The same code below, that inherits from ESServiceLimited
 */
export class ESServiceExtended extends ESService {
    /**
     *
     */
    interval: any;
    configService: ConfigService;
    constructor(configService: ConfigService, bcastService: BroadcastService, host?: string, username?: string, password?: string) {
        super(configService, host, username, password);
        this.configService = configService;
        this.configService.events.on('ready', async () => {
            logger.info(`config service is ready`);
            await this.startReconfigureES();
        })
        bcastService.on('configChanged', async (evt: ConfigWatch<any>) => {
            if (evt.path.startsWith('/config/es')) {
                logger.info(`es config changed`)
                await this.startReconfigureES();
            }
        })
        this.startReconfigureES();

    }

    public async startReconfigureES() {
        try {

            const es = await this.configService.getES();
            logger.info(`configuring es again ${es.host || ''}`)
            if (es.host)
                await this.reConfigure(es.host, es.user, es.pass);
            else
                await this.reConfigure(process.env.ES_HOST || 'https://localhost:9200', process.env.ES_USER, process.env.ES_PASS);
            if (this.interval)
                clearIntervalAsync(this.interval);
            this.interval = null;

        } catch (err) {
            logger.error(err);
            if (!this.interval) {
                this.interval = setIntervalAsync(async () => {
                    await this.startReconfigureES();
                }, 5000);

            }
        }
    }
    public async stop() {
        if (this.interval)
            clearIntervalAsync(this.interval);
        this.interval = null;
    }
}


