LeftHandGesture = {
    pointingUp: 0,
    pointingDown: 2,
    pointingNothing: 3,
    swipingFromTop: 6,
    swipingFromBottom: 8
};

RightHandGesture = {
    swipingRight: 9,
    swipingLeft: 10
};

Threshold = {
    leftHandSwiping: 0.03,
    rightHandSwiping: 0.03,
    minHorizontal: 0.35,
    verticalDifference: 0.008
};

var Kinect2 = require("kinect2"),
    kinect = new Kinect2(),
    io = require("socket.io")(8000);

var logger = {
    info: function(message) {
        console.log(new Date().toISOString() + " - info: " + message);
    },
    verbose: function(message) {}
};

/*	
var logger = require("winston");

require("winston-daily-rotate-file");

logger.configure({
    level: "info",
    transports: [
        new logger.transports.Console({
            timestamp: true,
            json: false
        })
        ,
        new logger.transports.File({
          filename: "nodejs_demo.log",
          json: false
        }),
        new logger.transports.DailyRotateFile({
          filename: "kinect-server.log",
          datePattern: ".yyyy-MM-dd",
          prepend: false,
          json: false
        })
    ]
});
*/

var lastLeftHandCameraX = null,
    lastLeftHandCameraY = null,
    lastRightHandCameraX = null,
    lastRightHandCameraY = null,
    lastLeftHandEventId = null,
    lastEventId = null;

function notifyRepeatableEvent(eventId) {
    switch (eventId) {
        case LeftHandGesture.pointingUp:
            logger.info("Left Hand Pointing Up");
            break;
        case LeftHandGesture.pointingDown:
            logger.info("Left Hand Pointing Down");
            break;
        case LeftHandGesture.pointingNothing:
            logger.info("Left Hand Pointing Nothing");
            break;
        case LeftHandGesture.swipingFromTop:
            logger.info("Left Hand Swiping from Top");
            break;
        case LeftHandGesture.swipingFromBottom:
            logger.info("Left Hand Swiping from Bottom");
            break;
        case RightHandGesture.swipingRight:
            logger.info("Right Hand Swiping Right");
            break;
        case RightHandGesture.swipingLeft:
            logger.info("Right Hand Swiping Left");
    }

    io.sockets.emit("eventId", eventId);
}

function notifyEvent(eventId) {
    if (eventId == lastEventId) {
        return;
    }

    lastEventId = eventId;
    notifyRepeatableEvent(eventId, null);
}

if (!kinect.open()) {
    throw "Kinect Opening Failure";
}

kinect.on("bodyFrame", function(bodyFrame) {
    //io.sockets.emit("bodyFrame", bodyFrame);

    var minZPoint = 5000,
        activeBodyIndex = null;

    for (var i = 0; i < bodyFrame.bodies.length; i++) {
        var body = bodyFrame.bodies[i];

        if (body.tracked) {
            var zMeters = body.joints[Kinect2.JointType.spineShoulder].cameraZ;
			
            if (zMeters < minZPoint && body.joints[Kinect2.JointType.spineShoulder].cameraX < Threshold.minHorizontal) {
                minZPoint = zMeters;
                activeBodyIndex = i;
            }
        }
    }

    if (activeBodyIndex == null) {
        return;
    }

    var body = bodyFrame.bodies[activeBodyIndex],
        shoulderSpineCenterCameraY = body.joints[Kinect2.JointType.spineShoulder].cameraY,
        spineBaseCameraY = body.joints[Kinect2.JointType.spineBase].cameraY,
        leftHandTip = body.joints[Kinect2.JointType.handTipLeft],
        rightHandTip = body.joints[Kinect2.JointType.handTipRight];

    /*
     *  Left Hand Gesture Handling
     */

    if (lastLeftHandCameraX == null) {
        lastLeftHandCameraX = leftHandTip.cameraX;
        logger.verbose("Initialized 'lastLeftHandCameraX' variable with value " + lastLeftHandCameraX);
    }
    if (lastLeftHandCameraY == null) {
        lastLeftHandCameraY = leftHandTip.cameraY;
        logger.verbose("Initialized 'lastLeftHandCameraY' variable with value " + lastLeftHandCameraY);
    }

    if (body.leftHandState == Kinect2.HandState.lasso || body.leftHandState == Kinect2.HandState.open) {
        if (leftHandTip.cameraY > shoulderSpineCenterCameraY) {
            if ((lastLeftHandEventId == LeftHandGesture.pointingUp || lastLeftHandEventId == LeftHandGesture.swipingFromTop) &&
                (lastLeftHandCameraX - leftHandTip.cameraX) > Threshold.leftHandSwiping &&
                Math.abs(leftHandTip.cameraY - lastLeftHandCameraY) < Threshold.verticalDifference) {
                lastLeftHandEventId = LeftHandGesture.swipingFromTop;
                notifyRepeatableEvent(LeftHandGesture.swipingFromTop);
            } else {
                lastLeftHandEventId = LeftHandGesture.pointingUp;
                notifyEvent(LeftHandGesture.pointingUp);
            }
        } else if (leftHandTip.cameraY <= shoulderSpineCenterCameraY &&
            leftHandTip.cameraY > spineBaseCameraY) {
            if ((lastLeftHandEventId == LeftHandGesture.pointingDown || lastLeftHandEventId == LeftHandGesture.swipingFromBottom) &&
                (lastLeftHandCameraX - leftHandTip.cameraX) > Threshold.leftHandSwiping &&
                Math.abs(leftHandTip.cameraY - lastLeftHandCameraY) < Threshold.verticalDifference) {
                lastLeftHandEventId = LeftHandGesture.swipingFromBottom;
                notifyRepeatableEvent(LeftHandGesture.swipingFromBottom);
            } else {
                lastLeftHandEventId = LeftHandGesture.pointingDown;
                notifyEvent(LeftHandGesture.pointingDown);
            }
        } else {
            lastLeftHandEventId = LeftHandGesture.pointingNothing;
            notifyEvent(LeftHandGesture.pointingNothing);
        }
    } else if (body.leftHandState != Kinect2.HandState.unknown) {
        lastLeftHandEventId = LeftHandGesture.pointingNothing;
        notifyEvent(LeftHandGesture.pointingNothing);
    }

    lastLeftHandCameraX = leftHandTip.cameraX;
    lastLeftHandCameraY = leftHandTip.cameraY;


    /*
     *  Right Hand Gesture Handling
     */

    if (lastRightHandCameraX == null) {
        lastRightHandCameraX = rightHandTip.cameraX;
        logger.verbose("Initialized 'lastRightHandCameraX' variable with value " + lastRightHandCameraX);
    }
    if (lastRightHandCameraY == null) {
        lastRightHandCameraY = rightHandTip.cameraY;
        logger.verbose("Initialized 'lastRightHandCameraY' variable with value " + lastRightHandCameraY);
    }

    if ((body.rightHandState == Kinect2.HandState.lasso || body.rightHandState == Kinect2.HandState.open) &&
        (rightHandTip.cameraY > shoulderSpineCenterCameraY) &&
        Math.abs(rightHandTip.cameraY - lastRightHandCameraY) < Threshold.verticalDifference) {
        if ((rightHandTip.cameraX - lastRightHandCameraX) > Threshold.rightHandSwiping) {
            notifyRepeatableEvent(RightHandGesture.swipingRight);
        } else if ((rightHandTip.cameraX - lastRightHandCameraX) < -Threshold.rightHandSwiping) {
            notifyRepeatableEvent(RightHandGesture.swipingLeft);
        }
    }

    lastRightHandCameraX = rightHandTip.cameraX;
    lastRightHandCameraY = rightHandTip.cameraY;
});

//request body frames
kinect.openBodyReader();
logger.info("Body Reader Opened");