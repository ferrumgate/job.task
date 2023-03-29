
//docker run --net=host --name redis --rm -d redis


import chai from 'chai';
import chaiHttp from 'chai-http';

import fs from 'fs';
import { RedisConfigWatchService, RedisService, SystemLogService, Tunnel, Util } from 'rest.portal';
import { BroadcastService } from 'rest.portal/service/broadcastService';

import { SystemWatcherTask } from '../src/task/systemWatcherTask';



chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
const encKey = 'unvjukt3i62bxkr0d6f0lpvlho5fvqb1'
describe('systemWatcherTask', () => {
    const redis = new RedisService();

    beforeEach(async () => {
        await redis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
        fs.mkdirSync(tmpfolder);
    })
    afterEach(async () => {

    })

    class MockConfig extends RedisConfigWatchService {
        /**
         *
         */
        constructor(systemlog?: SystemLogService) {
            super(new RedisService(), new RedisService(),
                systemlog || new SystemLogService(new RedisService(), new RedisService(), encKey), true, encKey)

        }
    }


    it('configChanged', async () => {

        const bcast = new BroadcastService();
        let isConfigCalled = false;

        bcast.on('configChanged', (tun: Tunnel) => {
            isConfigCalled = true;

        })
        const systemlog = new SystemLogService(new RedisService(), new RedisService(), encKey);
        const config = new MockConfig(systemlog);
        await config.start();
        await Util.sleep(3000);

        const watcher = new SystemWatcherTask(redis, config, bcast);
        await watcher.start();
        await systemlog.write({ path: '/config/users', type: 'put', val: { id: '1231' } })
        await Util.sleep(2000);
        expect(isConfigCalled).to.be.true;


    }).timeout(100000)





})