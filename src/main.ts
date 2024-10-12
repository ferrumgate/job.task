import { ESServiceExtended, InputService, logger, RedisConfigServiceConfigured, RedisConfigWatchCachedService, RedisService, SystemLogService, Util } from "rest.portal";
import { BroadcastService } from "rest.portal/service/broadcastService";
import { RedisOptions } from "./model/redisOptions";
import { FqdnIntelligenceListsTask } from "./task/fqdnIntelligenceListsTask";
import { IpIntelligenceListsTask } from "./task/ipIntelligenceListsTask";
import { SystemWatcherTask } from "./task/systemWatcherTask";
import { NodeSaveTask } from "./task/node/nodeSaveTask";
import { NodeIAmAliveTask } from "./task/node/nodeIAmAliveTask";
import { NodeCloudIAmAliveTask } from "./task/node/nodeCloudIAmAliveTask";
import { EsDeleteTask } from "./task/node/esDeleteTask";
import fs from "fs";

function createRedis(opt: RedisOptions) {

    return new RedisService(opt.host, opt.password);
}

async function main() {

    const redisHost = process.env.REDIS_HOST || 'localhost:6379';
    const redisPassword = process.env.REDIS_PASS;

    const redisIntelHost = process.env.REDIS_INTEL_HOST || 'localhost:6379';
    const redisIntelPassword = process.env.REDIS_INTEL_PASS;

    const esHost = process.env.ES_HOST || 'https://localhost:9200';
    const esUser = process.env.ES_USER || 'elastic'
    const esPass = process.env.ES_PASS || '';

    const encryptKey = process.env.ENCRYPT_KEY || Util.randomNumberString(32);
    const gatewayId = process.env.GATEWAY_ID || Util.randomNumberString(16);
    const nodeId = process.env.NODE_ID || Util.randomNumberString(16);

    const redisOptions: RedisOptions = { host: redisHost, password: redisPassword };
    const redisIntelOptions: RedisOptions = { host: redisIntelHost, password: redisIntelPassword };

    const inputService = new InputService();

    const redis = createRedis(redisOptions);
    const redisIntel = createRedis(redisIntelOptions);

    const systemLog = new SystemLogService(redis, createRedis(redisOptions), encryptKey, `job.task/${nodeId}`);
    const redisConfig = new RedisConfigWatchCachedService(redis, createRedis(redisOptions), systemLog, true, encryptKey, `job.task/${nodeId}`);
    const bcastService = new BroadcastService();
    const esIntelService = ESServiceExtended.create(redisConfig, esHost, esUser, esPass);
    const esService = ESServiceExtended.create(redisConfig, esHost, esUser, esPass);
    const redisConfigConfigured = new RedisConfigServiceConfigured(redis, createRedis(redisOptions), systemLog, encryptKey, `job.task/${nodeId}`);
    await redisConfigConfigured.start();


    //follow system
    const systemWatcher = new SystemWatcherTask(redis, redisConfig, bcastService);
    await systemWatcher.start();
    //ip intelligence
    let ipIntelligenceListsTask: IpIntelligenceListsTask | null = null;
    if (process.env.MODULE_IP_INTELLIGENCE == 'true') {
        ipIntelligenceListsTask = new IpIntelligenceListsTask(redis, redisIntel, redisConfig, esIntelService, bcastService, inputService);
        await ipIntelligenceListsTask.start();
    }

    //fqdn intelligence
    let fqdnIntelligenceListsTask: FqdnIntelligenceListsTask | null = null;
    if (process.env.MODULE_FQDN_INTELLIGENCE == 'true') {
        fqdnIntelligenceListsTask = new FqdnIntelligenceListsTask(redis, redisIntel, redisConfig, esIntelService, bcastService, inputService);
        await fqdnIntelligenceListsTask.start();
    }

    //node tasks
    let nodeSaveTask: NodeSaveTask | null = null;
    let nodeIAmAliveTask: NodeIAmAliveTask | null = null;
    let nodeCloudIAmAliveTask: NodeCloudIAmAliveTask | null = null;
    let esDeleteTask: EsDeleteTask | null = null;

    if (process.env.MODULE_NODE == 'true') {
        nodeSaveTask = new NodeSaveTask(redis, createRedis(redisOptions), redisConfigConfigured, systemLog, encryptKey);
        await nodeSaveTask.start();

        nodeIAmAliveTask = new NodeIAmAliveTask(redis);
        await nodeIAmAliveTask.start();

        nodeCloudIAmAliveTask = new NodeCloudIAmAliveTask();
        await nodeCloudIAmAliveTask.start();
        //only master nodes deletes
        if (process.env.ROLES?.includes('master')) {
            esDeleteTask = new EsDeleteTask(esService);
            await esDeleteTask.start();
        }
    }



    async function stopEverything() {
        await redisConfigConfigured.stop();
        await systemWatcher.stop();
        await redisConfig.stop();
        await ipIntelligenceListsTask?.stop();
        await fqdnIntelligenceListsTask?.stop();
        await nodeSaveTask?.stop();
        await nodeIAmAliveTask?.stop();
        await nodeCloudIAmAliveTask?.stop();
        await esDeleteTask?.stop();
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