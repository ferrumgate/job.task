import { ESService, ESServiceExtended, InputService, logger, RedisConfigWatchCachedService, RedisService, SystemLogService, Util } from "rest.portal";
import { BroadcastService } from "rest.portal/service/broadcastService";
import { RedisOptions } from "./model/redisOptions";
import { IpIntelligenceListsTask } from "./task/ipIntelligenceListsTask";
import { SystemWatcherTask } from "./task/systemWatcherTask";




function createRedis(opt: RedisOptions) {

    return new RedisService(opt.host, opt.password);
}

async function main() {



    const redisHost = process.env.REDIS_HOST || 'localhost:6379';
    const redisPassword = process.env.REDIS_PASS;
    const encryptKey = process.env.ENCRYPT_KEY || Util.randomNumberString(32);

    const redisOptions: RedisOptions = { host: redisHost, password: redisPassword };

    const inputService = new InputService();

    const redis = createRedis(redisOptions);

    const systemLog = new SystemLogService(redis, createRedis(redisOptions), encryptKey, 'job.task');
    const redisConfig = new RedisConfigWatchCachedService(redis, createRedis(redisOptions), systemLog, true, encryptKey, 'job.task');
    const bcastService = new BroadcastService();
    const esService = new ESServiceExtended(redisConfig);

    //follow system
    const systemWatcher = new SystemWatcherTask(redis, redisConfig, bcastService);
    await systemWatcher.start();

    const ipIntelligenceListsTask = new IpIntelligenceListsTask(redis, redisConfig, esService, bcastService, inputService);
    await ipIntelligenceListsTask.start();

    async function stopEverything() {
        await systemWatcher.stop();
        await redisConfig.stop();
        await ipIntelligenceListsTask.stop();
    }

    process.on('SIGINT', async () => {

        await stopEverything();
        process.exit(0);

    });
    process.on('SIGTERM', async () => {

        await stopEverything();
        process.exit(0);

    });

}

// start process
main()
    .catch(err => {
        logger.error(err);
        process.exit(1);
    })