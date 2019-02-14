var FB = require('fb');
var WebClient = require('@slack/client').WebClient;
var dateFormat = require('dateformat');
var fs = require('fs');

exports.handler = (event, context, callback) => {

    const fb_client_id = process.env.FB_CLIENT_ID;
    const fb_client_secret = process.env.FB_CLIENT_SECRET;
    const fb_page_id = process.env.FB_PAGE_ID;
    const token = process.env.SLACK_TOKEN;
    const text_event = process.env.TEXT_EVENT;

    let createResponse = function(statusCode, body) {
        return {
            "statusCode": statusCode,
            "body": JSON.stringify(body)
        };
    };

    let challenge = '';
    let type = '';
    let payload_type = '';
    let payload_text = '';
    let payload_channel_id = '';
    
    if (event.body !== null && event.body !== undefined) {
        let body = JSON.parse(event.body);

        if (body.challenge)
            challenge = body.challenge;
        if (body.type)
            type = body.type;

        if (body.event !== null && body.event !== undefined) {
            let payload = body.event;
            if (payload.type)
                payload_type = payload.type;
            if (payload.text)
                payload_text = payload.text;
            if (payload.channel)
                payload_channel_id = payload.channel;
        }
    }
    
    console.log("Message trigger: ", payload_text);

    if (type === "url_verification") {
        //Response slack challenge event
        callback(null, createResponse(200, { "challenge": challenge }));
    }
    else if (type === "event_callback" && payload_type === "message" && payload_text === text_event) {
        
        let countdown = true;
        if (fs.existsSync('/tmp/timestamp.json')) {
            let file = fs.readFileSync('/tmp/timestamp.json');
            let data_read = JSON.parse(file);
            countdown = (data_read.timestamp+420000) < (new Date().getTime());
        }
        let data_write = JSON.stringify({timestamp: new Date().getTime()});
        fs.writeFile('/tmp/timestamp.json', data_write, (err) => {
            if (err) console.log(err);
        });
        
        if (countdown) {
            FB.api(
                'oauth/access_token',
                'GET', {
                    "client_id": fb_client_id,
                    "client_secret": fb_client_secret,
                    "grant_type": "client_credentials"
                },
                function(response) {
                    FB.setAccessToken(response.access_token);
                    let posts_limit = 2;
                    FB.api('/' + fb_page_id +'/feed', 'GET', { "limit": posts_limit },
                        function(response) {
                            let web = new WebClient(token);
                            for (let i=0; i<posts_limit; i++) {
                                let fb_post_date = dateFormat(response.data[i].created_time, "dd/mm/yyyy");
                                let fb_post_message = response.data[i].message;
                                let response_message = 'Menù del ' + fb_post_date + '\n\n' + fb_post_message;
                                let params = {
                                    channel: payload_channel_id,
                                    text: response_message
                                };
                                if(fb_post_message!==undefined) {
                                    web.chat.postMessage(params)
                                        .then((result) => {
                                            console.log('Message sent: ', result.ts);
                                        })
                                        .catch(console.error);
                                    callback(null, createResponse(200, response_message));
                                    break;
                                }
                            }
                        });
                }
        );
        }
    }
    else {
        callback(null, createResponse(204, ''));
    }
    callback(null, createResponse(500, ''));
};
