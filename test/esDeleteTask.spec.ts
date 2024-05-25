import chai from 'chai';
import chaiHttp from 'chai-http';
import { esHost, esPass, esUser } from './common.spec';
import { ActivityLog, ConfigService, ESService, Util } from 'rest.portal';
import { EsDeleteTask } from '../src/task/node/esDeleteTask';

chai.use(chaiHttp);
const expect = chai.expect;

const host = esHost;
const user = esUser;
const pass = esPass;
describe.skip('esService ', async () => {

    const config = new ConfigService('fljvc7rm1xfo37imbu3ryc5mfbh9jpm5', `/tmp/${Util.randomNumberString()}`)
    beforeEach(async () => {
        await config.setES({ host: esHost, user: esUser, pass: esPass })
        try {
            const es = new ESService(config, esHost, esUser, esPass, '1s');
            await es.reset();
        } catch (err) {

        }
    })

    function createSampleData3() {
        let activity1: ActivityLog = {
            insertDate: new Date().toISOString(),
            authSource: 'local',
            ip: '1.2.3.4',
            requestId: '123456',
            status: 0,
            statusMessage: 'SUCCESS',
            type: 'login try',
            sessionId: 's1',
            username: 'abc'
        }
        let activity2: ActivityLog = {
            insertDate: new Date(2021, 1.2).toISOString(),
            authSource: 'activedirectory',
            ip: '1.2.3.5',
            requestId: '1234567',
            status: 401,
            statusMessage: 'ERRAUTH',
            type: 'login 2fa',
            sessionId: 's1',
            username: 'abc@def',
            is2FA: true
        }
        return { activity1, activity2 };
    }

    it('deleteTask', async () => {
        const es = new ESService(config, host, user, pass, '1s');
        const { activity1, activity2 } = createSampleData3();
        const data1 = await es.activityCreateIndexIfNotExits(activity1);
        const data2 = await es.activityCreateIndexIfNotExits(activity2);
        await es.activitySave([data1, data2]);

        await Util.sleep(10000);
        const indexes = await es.getAllIndexes();
        expect(indexes.length).to.be.equal(2);
        const deleteTask = new EsDeleteTask(es, 1);
        await deleteTask.check();

        await Util.sleep(10000);
        const indexes2 = await es.getAllIndexes();
        expect(indexes2.length).to.be.equal(1);



    }).timeout(60000);
});