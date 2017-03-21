/**
 * @providesModule LightboxOverlay
 */
'use strict';

var React = require('react');
var {
  PropTypes,
} = React;
var {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  BackAndroid,
} = require('react-native');

var DRAG_DISMISS_THRESHOLD = 50;
var STATUS_BAR_OFFSET = (Platform.OS === 'android' ? -25 : 0);

var LightboxOverlay = React.createClass({
  propTypes: {
    origin: PropTypes.shape({
      x:        PropTypes.number,
      y:        PropTypes.number,
      width:    PropTypes.number,
      height:   PropTypes.number,
    }),
    springConfig: PropTypes.shape({
      tension:  PropTypes.number,
      friction: PropTypes.number,
    }),
    backgroundColor: PropTypes.string,
    isOpen:          PropTypes.bool,
    renderHeader:    PropTypes.func,
    onOpen:          PropTypes.func,
    onClose:         PropTypes.func,
    onHitClose:      PropTypes.func,
    swipeToDismiss:  PropTypes.bool,
  },

  getInitialState: function() {
    return {
      isAnimating: false,
      isPanning: false,
      target: {
        x: 0,
        y: 0,
        opacity: 1,
      },
      pan: new Animated.Value(0),
      openVal: new Animated.Value(0),
    };
  },

  getDefaultProps: function() {
    return {
      springConfig: { tension: 30, friction: 7 },
      backgroundColor: 'black',
    };
  },

  componentWillMount: function() {
    var windowHeight = Dimensions.get('window').height;

    this._panResponder = PanResponder.create({
      // Ask to be the responder:
      onStartShouldSetPanResponder: (evt, gestureState) => !this.state.isAnimating,
      onStartShouldSetPanResponderCapture: (evt, gestureState) => !this.state.isAnimating,
      onMoveShouldSetPanResponder: (evt, gestureState) => !this.state.isAnimating,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => !this.state.isAnimating,

      onPanResponderGrant: (evt, gestureState) => {
        this.state.pan.setValue(0);
        this.setState({ isPanning: true });
      },
      onPanResponderMove: Animated.event([
        null,
        {dy: this.state.pan}
      ]),
      onPanResponderTerminationRequest: (evt, gestureState) => true,
      onPanResponderRelease: (evt, gestureState) => {
        if(Math.abs(gestureState.dy) > DRAG_DISMISS_THRESHOLD) {
          this.setState({
            isPanning: false,
            target: {
              y: gestureState.dy,
              x: gestureState.dx,
              opacity: 1 - Math.abs(gestureState.dy / windowHeight)
            }
          });
          this.close();
        } else {
          Animated.spring(
            this.state.pan,
            {toValue: 0, ...this.props.springConfig}
          ).start(() => { this.setState({ isPanning: false }); });
        }
      },
    });
  },

  componentDidMount: function() {
    if(this.props.isOpen) {
      this.open();
    }
  },

  onAndroidBack: function() {
       if(this.props.isOpen) {
         BackAndroid.removeEventListener('hardwareBackPress', this.onAndroidBack);
         this.close();
         return true;
       }
       return false;
   },

  open: function() {
    StatusBar.setHidden(true, 'fade');
    BackAndroid.addEventListener('hardwareBackPress', this.onAndroidBack);

    this.state.pan.setValue(0);
    this.setState({
      isAnimating: true,
      target: {
        x: 0,
        y: 0,
        opacity: 1,
      }
    });

    Animated.spring(
      this.state.openVal,
      { toValue: 1, ...this.props.springConfig }
    ).start(() => this.setState({ isAnimating: false }));
  },

  close: function() {
    this.props.onHitClose();
    StatusBar.setHidden(false, 'fade');
    this.setState({
      isAnimating: true,
    });
    Animated.spring(
      this.state.openVal,
      { toValue: 0, ...this.props.springConfig }
    ).start(() => {
      this.setState({
        isAnimating: false,
      });
      this.props.onClose();
    });
  },

  componentWillReceiveProps: function(props) {
    if(this.props.isOpen != props.isOpen && props.isOpen) {
      this.open();
    }
  },

  render: function() {
    var windowHeight = Dimensions.get('window').height;
    var windowWidth = Dimensions.get('window').width;

    var {
      isOpen,
      renderHeader,
      swipeToDismiss,
      origin,
      backgroundColor,
    } = this.props;

    var {
      isPanning,
      isAnimating,
      openVal,
      target,
    } = this.state;


    var lightboxOpacityStyle = {
      opacity: openVal.interpolate({inputRange: [0, 1], outputRange: [0, target.opacity]})
    };

    var handlers;
    if(swipeToDismiss) {
      handlers = this._panResponder.panHandlers;
    }

    var dragStyle;
    if(isPanning) {
      dragStyle = {
        top: this.state.pan,
      };
      lightboxOpacityStyle.opacity = this.state.pan.interpolate({inputRange: [-windowHeight, 0, windowHeight], outputRange: [0, 1, 0]});
    }

    var openStyle = [styles.open, {
      left:   openVal.interpolate({inputRange: [0, 1], outputRange: [origin.x, target.x]}),
      top:    openVal.interpolate({inputRange: [0, 1], outputRange: [origin.y + STATUS_BAR_OFFSET, target.y + STATUS_BAR_OFFSET]}),
      width:  openVal.interpolate({inputRange: [0, 1], outputRange: [origin.width, windowWidth]}),
      height: openVal.interpolate({inputRange: [0, 1], outputRange: [origin.height, windowHeight]}),
    }];

    const closeButton = (
      <TouchableOpacity onPress={this.close}>
        <Text style={styles.closeButton}>×</Text>
      </TouchableOpacity>
    );

    const closeAndConfirmButtons = (
      <View style={{justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center'}}>
        {closeButton}
        <TouchableOpacity onPress={() => { this.props.onConfirm(); this.close(); }}>
          <Image style={styles.confirmButton} source={this.props.confirmIcon}/>
        </TouchableOpacity>
      </View>
    );

    const defaultHeader = this.props.onConfirm ? closeAndConfirmButtons : closeButton;

    var background = (<Animated.View style={[styles.background, { backgroundColor: backgroundColor }, lightboxOpacityStyle]}></Animated.View>);
    var header = (<Animated.View style={[styles.header, lightboxOpacityStyle]}>{(renderHeader ?
      renderHeader(this.close) :
      (
        defaultHeader
      )
    )}</Animated.View>);
    var content = (
      <Animated.View style={[openStyle, dragStyle]} {...handlers}>
        {this.props.children}
      </Animated.View>
    );
    if(this.props.navigator) {
      return (
        <View>
          {background}
          {content}
          {header}
        </View>
      );
    }
    return (
      <Modal visible={isOpen} onRequestClose={() => null} transparent={true}>
        {background}
        {content}
        {header}
      </Modal>
    );
  }
});

var styles = StyleSheet.create({
  background: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  open: {
    position: 'absolute',
    flex: 1,
    justifyContent: 'center',
    // Android pan handlers crash without this declaration:
    backgroundColor: 'transparent',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  closeButton: {
    fontSize: 35,
    color: 'white',
    lineHeight: 40,
    width: 40,
    textAlign: 'center',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowRadius: 1.5,
    shadowColor: 'black',
    shadowOpacity: 0.8,
  },
  confirmButton: {
    marginRight: 10,
    marginTop: 5,
  }
});

module.exports = LightboxOverlay;
