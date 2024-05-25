import { BaseTask } from "../task";
import fsp from 'fs/promises';

/**
 * @summary a base class that supports gatewayId
 */
export abstract class NodeBasedTask extends BaseTask {

    protected nodeId = process.env.NODE_ID || '';
    protected deployId = process.env.DEPLOY_ID || '';
    protected version = process.env.VERSION || '';
    protected roles = process.env.ROLES || '';
    protected encryptKey = process.env.ENCRYPT_KEY || '';
    protected hostname = process.env.CLUSTER_NODE_HOST || '';
    protected cloudId = process.env.FERRUM_CLOUD_ID || '';
    protected cloudUrl = process.env.FERRUM_CLOUD_URL || '';
    protected cloudToken = process.env.FERRUM_CLOUD_TOKEN || '';
    protected nodeIpw = process.env.CLUSTER_NODE_IPW || '';
    protected nodePortw = process.env.CLUSTER_NODE_PORTW || '';
    protected nodePublicKey = process.env.CLUSTER_NODE_PUBLIC_KEY || '';
    protected nodeIp = process.env.CLUSTER_NODE_IP || '';
    protected nodePort = process.env.CLUSTER_NODE_PORT || '';


    /**
     *
     */
    constructor() {
        super();

    }
}