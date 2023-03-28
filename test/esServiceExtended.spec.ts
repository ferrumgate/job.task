
import chai from 'chai';
import { ConfigService, ESService, RedisService, Util } from 'rest.portal';
import { ESServiceExtended } from '../src/service/esServiceExtended';




const expect = chai.expect;
const esHost = 'https://192.168.88.250:9200';
const esUser = "elastic";
const esPass = '123456';

describe('esServiceExtended ', async () => {
    const redis = new RedisService();
    beforeEach(async () => {

        await redis.flushAll();

    })

    it('connect', async () => {
        const filename = `/tmp/${Util.randomNumberString()}config.yaml`;
        const configService = new ConfigService('mn4xq0zeryusnagsdkbb2a68r7uu3nn25q4i91orj3ofkgb42d6nw5swqd7sz4fm', filename);
        await configService.setES({ host: esHost, user: esUser, pass: esPass });
        const es = new ESService(configService, esHost, esUser, esPass);
        await Util.sleep(1000);
        const indexes = await es.getAllIndexes();




    }).timeout(20000);



})