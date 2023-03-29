/**
 * @follow ip intelligence lists and prepare for system
 */

import { ConfigService, ESService, InputService, IpIntelligenceList, IpIntelligenceListService, logger, RedisConfigService, RedisConfigWatchCachedService, RedisService, RedLockService } from "rest.portal";
import { ConfigWatch } from "rest.portal/model/config";
import { BroadcastService } from "rest.portal/service/broadcastService";
import { BaseTask } from "./task";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');

export class IpIntelligenceListTask {

    lastExecuteTime: number = 0;

    /**
     *
     */
    constructor(public list: IpIntelligenceList, protected intel: IpIntelligenceListService) {

    }
    async execute() {
        if (this.lastExecuteTime) return;

        let needsExecute = false;
        let status = await this.intel.getListStatus(this.list);
        if (!status)
            needsExecute = true;
        else
            if (!status.hash)
                needsExecute = true;


        if (this.list.file) {
            if (needsExecute) {
                logger.info(`ip intelligence list ${this.list.name} executing`);
                await this.intel.process(this.list);
            } else {
                logger.info(`ip intelligence list ${this.list.name} not changed`);
            }
        }
        if (this.list.http && needsExecute) {
            const diff = new Date().getTime() - this.lastExecuteTime;
            if (diff >= this.list.http.checkFrequency * 60 * 1000) {
                logger.info(`ip intelligence list ${this.list.name} executing`);
                await this.intel.process(this.list);
            } else {
                logger.info(`ip intelligence list ${this.list.name} not changed`);
            }
        }
        this.lastExecuteTime = new Date().getTime();

    }

}


export class IpIntelligenceListsTask extends BaseTask {
    /**
     *
     */
    ipIntel: IpIntelligenceListService;
    microTasks: IpIntelligenceListTask[] = [];
    timer: any;
    resetActivated = false;
    listsChanged = false;
    locker: RedLockService;
    lastCheckSystem = 0;
    constructor(protected redisService: RedisService,
        protected configService: RedisConfigWatchCachedService,
        protected esService: ESService,
        protected bcastService: BroadcastService,
        protected inputService: InputService) {
        super();
        this.locker = new RedLockService(redisService);
        this.ipIntel = new IpIntelligenceListService(redisService, inputService, esService);
        this.bcastService.on('configChanged', async (evt: ConfigWatch<any>) => {
            //watch system wide config changes
            await this.onConfigChanged(evt);
        })

    }


    public async onConfigChanged(event: ConfigWatch<any>) {
        try {
            if (event.path.startsWith('/config/flush')) {
                logger.info(`config flushed check everything`);
                this.resetActivated = true;
            }

            if (event.path.startsWith('/config/es')) {
                logger.info(`es config changed`)
                this.resetActivated = true;
            }
            if (event.path.startsWith('/config/ipIntelligence/lists')) {
                logger.info(`lists changed`)
                this.listsChanged = true;
            }



        } catch (err) {
            logger.error(err);
        }
    }

    async start() {
        await this.locker.lock('/lock/ipIntelligence/execute/lists');
        this.timer = setIntervalAsync(async () => {
            await this.execute();
            await this.executeSystemCheck();
        }, 60 * 1000)//check every minute;
    }

    async stop() {
        await this.locker.release(true);
        if (this.timer)
            clearIntervalAsync(this.timer);
        this.timer = null;
    }
    async executeSystemCheck() {
        if (new Date().getTime() - this.lastCheckSystem < 1 * 60 * 60 * 1000)
            return;
        await this.executeES();
        await this.executeListsFiles();
    }
    /**
     * check es indexes to system lists
     */
    async executeES() {
        try {


            logger.info(`checking es to ip intelligence lists`);
            //get all lists
            const lists = await this.configService.getIpIntelligenceLists();
            const mappedLists = lists.map(y => {
                return {
                    index: `ip-intelligence-list-${y.id.toLowerCase()}`,
                    item: y
                }
            });
            //get all indexes from es
            const esLists = await this.esService.getAllIndexes();
            //and delete if not exits in db list
            const filteredESLists = esLists.filter(x => x.includes('ip-intelligence-list-'));
            for (const it of filteredESLists) {
                if (!mappedLists.find(y => y.index == it)) {//not found
                    logger.info(`deleting es index ${it}`);
                    await this.esService.deleteIndexes([it]);
                }
            }

        } catch (err) {
            logger.error(err);
        }
    }

    /**
     * check system status to system lists
     */
    async executeListsFiles() {
        try {
            logger.info(`check ip intelligence status to lists`);
            const lists = await this.configService.getIpIntelligenceLists();

            await this.ipIntel.compareSystemHealth(lists);

        } catch (err) {
            logger.error(err);
        }
    }


    async handleItem(task: IpIntelligenceListTask) {
        await task.execute();
    }

    async execute() {
        try {
            if (!this.locker.isLocked) {
                logger.info(`could not grab lock`);
                return;
            };
            if (this.resetActivated)
                await this.resetEverything();
            logger.info(`checking ip intelligence lists`);
            //get all lists
            const lists = await this.configService.getIpIntelligenceLists();

            //check if all exits in out watch list
            for (const it of lists) {
                if (!this.microTasks.find(y => y.list.id == it.id)) {//not found
                    logger.info(`added ip intelligence to tasks ${it.name}`);
                    this.microTasks.push(new IpIntelligenceListTask(it, this.ipIntel));
                }
            }
            //check reverse
            let tasks = this.microTasks.filter(x => lists.find(y => y.id == x.list.id) ? true : false);
            for (const it of tasks) {
                if (this.resetActivated) break;//
                if (this.listsChanged) break;
                await it.execute();
            }
            if (this.resetActivated || this.listsChanged)
                this.microTasks = [];//clear everything
            if (this.resetActivated)
                await this.resetEverything();

        } catch (err) {
            logger.error(err);
        } finally {
            this.listsChanged = false;
        }
    }

    async startReconfigureES() {
        if (!this.locker.isLocked) {
            logger.info(`could not grab lock`);
            return;
        }
        const es = await this.configService.getES();
        if (es.host)
            await this.esService.reConfigure(es.host, es.user, es.pass);
        else
            await this.esService.reConfigure(process.env.ES_HOST || 'https://localhost:9200', process.env.ES_USER, process.env.ES_PASS);


    }
    async resetEverything() {
        await this.startReconfigureES()
        const lists = await this.configService.getIpIntelligenceLists();
        for (const it of lists) {
            await this.ipIntel.resetList(it);
        }
        this.resetActivated = false;
        this.microTasks = [];
    }

}