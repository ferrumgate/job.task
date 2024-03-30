import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiSpy from 'chai-spies';
import fs from 'fs';
import { ESService, FqdnIntelligenceList, FqdnIntelligenceListService, InputService, RedisConfigWatchCachedService, RedisService, SystemLogService, Util } from 'rest.portal';
import { BroadcastService } from 'rest.portal/service/broadcastService';
import { FqdnIntelligenceListTask, FqdnIntelligenceListsTask } from '../src/task/fqdnIntelligenceListsTask';
import { esHost, esPass, esUser } from './common.spec';

chai.use(chaiHttp);
chai.use(chaiSpy);
const expect = chai.expect;

const tmpfolder = '/tmp/ferrumtest';
const encKey = 'unvjukt3i62bxkr0d6f0lpvlho5fvqb1'

describe('FqdnIntelligenceListTask', () => {

    const redis = new RedisService();
    const systemLog = new SystemLogService(redis, new RedisService(), encKey, 'job.task');
    const configService = new RedisConfigWatchCachedService(redis, new RedisService(), systemLog, true, encKey, 'job.task');
    const redisService = new RedisService();
    const inputService = new InputService();
    const esService = new ESService(configService, esHost, esUser, esPass, '1s');
    const intel = new FqdnIntelligenceListService(redisService, inputService, esService);
    const bcastService = new BroadcastService();
    beforeEach(async () => {
        await redis.flushAll();
        if (fs.existsSync(tmpfolder))
            await fs.rmSync(tmpfolder, { recursive: true, force: true });
        fs.mkdirSync(tmpfolder);
        await redis.flushAll();
        await esService.reset();
    })
    afterEach(async () => {
        chai.spy.restore();
    })

    it('FqdnIntelligenceListTask execute', async () => {
        const list: FqdnIntelligenceList = {
            id: Util.randomNumberString(),
            insertDate: new Date().toISOString(),
            name: 'test',
            updateDate: new Date().toISOString(),
            file: {
                source: 'abc'
            }
        }

        const spyIntelProcess = chai.spy.on(intel, 'process');
        const listTask = new FqdnIntelligenceListTask(list, intel);
        listTask.lastExecuteTime = 100;
        await listTask.execute();
        expect(spyIntelProcess).not.called;

        //set back it 0
        listTask.lastExecuteTime = 0;
        let spyIntelStatus = chai.spy.on(intel, 'getListStatus', () => { return { hash: 'somehash' } });
        await listTask.execute();
        expect(spyIntelStatus).called;
        expect(spyIntelProcess).not.called;

    }).timeout(100000)
    it('FqdnIntelligenceListTask execute undefined status', async () => {
        const list: FqdnIntelligenceList = {
            id: Util.randomNumberString(),
            insertDate: new Date().toISOString(),
            name: 'test',
            updateDate: new Date().toISOString(),
            file: {
                source: 'abc'
            }
        }

        const spyIntelProcess = chai.spy.on(intel, 'process', (arg: any) => { });
        const listTask = new FqdnIntelligenceListTask(list, intel);

        listTask.lastExecuteTime = 0;
        let spyIntelStatus = chai.spy.on(intel, 'getListStatus');
        await listTask.execute();
        expect(spyIntelStatus).called;
        expect(spyIntelProcess).called;
        expect(listTask.lastExecuteTime > 0).to.be.true;

    }).timeout(100000)

    it('FqdnIntelligenceListTask execute undefined status and http frequency', async () => {
        const list: FqdnIntelligenceList = {
            id: Util.randomNumberString(),
            insertDate: new Date().toISOString(),
            name: 'test',
            updateDate: new Date().toISOString(),
            http: {
                checkFrequency: 1, url: ''
            }
        }

        const spyIntelProcess = chai.spy.on(intel, 'process', (arg: any) => { });
        const listTask = new FqdnIntelligenceListTask(list, intel);

        listTask.lastExecuteTime = 0;
        let spyIntelStatus = chai.spy.on(intel, 'getListStatus');
        await listTask.execute();
        expect(spyIntelStatus).called;
        expect(spyIntelProcess).called;

        // change time to now
        listTask.lastExecuteTime = new Date().getTime();
        await listTask.execute();
        expect(spyIntelStatus).called;
        expect(spyIntelProcess).not.called;

    }).timeout(100000);

    it('FqdnIntelligenceListsTask configChanged', async () => {

        const listTask = new FqdnIntelligenceListsTask(redis, redis, configService, esService, bcastService, inputService);

        const changedFunc = chai.spy.on(listTask, 'onConfigChanged', (ev) => { });

        bcastService.emit('configChanged');
        expect(changedFunc).called;

    }).timeout(100000)

    it('FqdnIntelligenceListsTask execute', async () => {

        const list: FqdnIntelligenceList = {
            id: Util.randomNumberString(),
            insertDate: new Date().toISOString(),
            name: 'test',
            updateDate: new Date().toISOString(),
            http: {
                checkFrequency: 1, url: ''
            }
        }

        const listTask = new FqdnIntelligenceListsTask(redis, redis, configService, esService, bcastService, inputService);

        const handleItem = chai.spy.on(listTask, 'handleItem', (ev) => { });
        const resetEverything = chai.spy.on(listTask, 'resetEverything', (ev) => { });
        const listsFunc = chai.spy.on(configService, 'getIpIntelligenceLists', () => [list]);

        await listTask.execute();
        expect(handleItem).called;
        expect(resetEverything).not.called;

        listTask.resetActivated = true;
        await listTask.execute();
        expect(handleItem).called;
        expect(resetEverything).called;

    }).timeout(100000)

    /*  it('FqdnIntelligenceListsTask executeES', async () => {
 
         const list: FqdnIntelligenceList = {
             id: Util.randomNumberString(),
             insertDate: new Date().toISOString(),
             name: 'test',
             updateDate: new Date().toISOString(),
             http: {
                 checkFrequency: 1, url: ''
             }
         }
 
         const listTask = new FqdnIntelligenceListsTask(redis, configService, esService, bcastService, inputService);
 
         const listsFunc = chai.spy.on(configService, 'getFqdnIntelligenceLists', () => [list]);
         const allIndexesFunc = chai.spy.on(esService, 'getAllIndexes', () => ['fqdn-intelligencelist-1']);
         const deleteIndexFunc = chai.spy.on(esService, 'deleteIndexes', (arg: any) => { });
 
         //await listTask.executeES();
         expect(deleteIndexFunc).called;
 
     }).timeout(100000)
  */

})