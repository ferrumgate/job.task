import os from 'os';
import { ESService, logger, RedisService } from "rest.portal";
import { NodeBasedTask } from "./nodeBasedTask";
import Axios, { AxiosRequestConfig } from "axios";
const { setIntervalAsync, clearIntervalAsync } = require('set-interval-async');

/***
 * 
 * @summary every day delete es index
 */
export class EsDeleteTask extends NodeBasedTask {

    protected timer: any | null = null;

    protected lastCheckTime2 = new Date(1).getTime();
    deleteAfterDays = Number(process.env.ES_DELETE_AFTER_DAYS) || 30;
    constructor(private esService: ESService, _deleteAfterDays?: number) {
        super();
        if (_deleteAfterDays)
            this.deleteAfterDays = _deleteAfterDays;
    }
    lastCheck = 0;
    public async check() {

        try {
            if (new Date().getTime() - this.lastCheck < 3 * 60 * 60 * 1000) return;//check every 3 hours
            let indexes = await this.esService.getAllIndexes();
            let indexesToDelete = indexes.filter(x => !x.startsWith('ferrumgate-audit'));
            indexesToDelete = indexesToDelete.sort((a, b) => {
                let date = a.split('-').pop();
                let dateAsNumber = Number(date);
                let date2 = b.split('-').pop();
                let dateAsNumber2 = Number(date2);
                return dateAsNumber - dateAsNumber2;
            });
            logger.info(`indexes to delete: ${indexesToDelete.join(',')}`);
            let remainingCount = indexesToDelete.length - this.deleteAfterDays;
            for (let index of indexesToDelete) {
                if (remainingCount > 0) {
                    await this.esService.deleteIndexes([`${index}`]);
                    logger.info(`deleted index: ${index}`);
                }
                remainingCount--;
            }


        } catch (err) {
            logger.error(err);
        }
    }

    public override async start(): Promise<void> {

        if (!this.roles.includes("master")) {
            logger.info(`only master nodes can delete es index`);
            return;
        }

        await this.check();
        this.timer = setIntervalAsync(async () => {
            await this.check();
        }, 5 * 60 * 1000);
    }
    public override async stop(): Promise<void> {
        try {
            if (this.timer)
                clearIntervalAsync(this.timer);
            this.timer = null;

        } catch (err) {
            logger.error(err);
        } finally {

        }
    }

}
