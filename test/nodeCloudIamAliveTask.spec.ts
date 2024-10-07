import chai from 'chai';
import chaiHttp from 'chai-http';
import fs from 'fs';
import { RedisConfigService, RedisService, SystemLogService, Util } from 'rest.portal';
import { NodeSaveTask } from '../src/task/node/nodeSaveTask';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { NodeCloudIAmAliveTask } from '../src/task/node/nodeCloudIAmAliveTask';
chai.use(chaiHttp);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
describe('NodeCloudIamAlive', () => {
    const simpleRedis = new RedisService('localhost:6379,localhost:6390');


    beforeEach(async () => {

        await simpleRedis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
    })

    it('check', async () => {


        var mock = new MockAdapter(axios);
        let data = { isCalled: false };
        mock.onPost('/api/cloud/alive').replyOnce(() => {
            data.isCalled = true;
            return [200, data]
        });
        const cloud = new NodeCloudIAmAliveTask();
        await cloud.check();
        expect(data.isCalled).to.be.true;

    }).timeout(100000)

})