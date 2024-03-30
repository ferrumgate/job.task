import { logger, RedisConfigWatchService, RedisService } from "rest.portal";
import { ConfigWatch } from "rest.portal/model/config";
import { BroadcastService } from "rest.portal/service/broadcastService";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');

/**
 * @summary follow all system status, configs and emit related events to system
 */
export class SystemWatcherTask {

    protected isStoping = false;

    constructor(private redis: RedisService,
        private redisConfigService: RedisConfigWatchService,
        private bcastService: BroadcastService,
    ) {

        this.redisConfigService.events.on('configChanged', async (data: ConfigWatch<any>) => {

            this.bcastService.emit('configChanged', data);
            logger.info(`system watcher config changed ${data.path}`);
        })

    }

    async start() {
        this.isStoping = false;
        await this.redisConfigService.start();
    }
    async stop() {
        this.isStoping = true;
        await this.redisConfigService.stop();
    }

}