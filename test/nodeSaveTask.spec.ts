import chai from 'chai';
import chaiHttp from 'chai-http';
import fs from 'fs';
import { RedisConfigService, RedisConfigServiceConfigured, RedisService, SystemLogService, Util } from 'rest.portal';
import { NodeSaveTask } from '../src/task/node/nodeSaveTask';

chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('NodeSave', () => {
    const simpleRedis = new RedisService('localhost:6379,localhost:6390');
    const simpleRedisStream = new RedisService('localhost:6379,localhost:6390');

    beforeEach(async () => {

        await simpleRedis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
    })

    it('check', async () => {
        const log = new SystemLogService(simpleRedis, simpleRedisStream);
        const encryptKey = Util.randomNumberString(32);
        const nodeId = Util.randomNumberString(16);
        class Mock extends NodeSaveTask {
            protected encryptKey: string = encryptKey;
            constructor(protected redis: RedisService, protected redisStream: RedisService, protected redisConfigService: RedisConfigService, protected log: SystemLogService) {
                super(redis, redisStream, redisConfigService, log, encryptKey);
                this.nodeId = nodeId;
                this.encryptKey = encryptKey;
            }
        }
        let configService = new RedisConfigService(simpleRedis, simpleRedisStream, log, encryptKey);
        configService.config.cloud = {};
        await configService.init();
        await configService.setIsConfigured(1);
        //
        const redisConfigService = new RedisConfigServiceConfigured(simpleRedis, simpleRedisStream, log, encryptKey);
        await redisConfigService.init();
        const save = new Mock(simpleRedis, simpleRedisStream, redisConfigService, log);
        await save.start();
        await Util.sleep(5000);
        await Util.sleep(5000);
        const host = await redisConfigService.getNode(nodeId);
        await redisConfigService.stop();
        await save.stop();
        expect(host).exist;
        if (host)
            expect(host.name).exist;


    }).timeout(100000)

})